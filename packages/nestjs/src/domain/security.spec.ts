import { describe, it, expect, vi } from 'vitest';
import { BoardService } from './board.service';
import { PrismaBoardAdapter } from '../adapters/prisma-board.adapter';
import { PermissionService } from './permission.service';
import { validateMutations, validateRenderable } from './security-validation';
import { AssetService } from './asset.service';
import { ExportService } from './export.service';
import { SyncRelay } from '../realtime/sync-relay';
import { BoardGateway } from '../realtime/board.gateway';
import { AssetController } from '../controllers/asset.controller';

const element = (pageId = 'page') => ({ id: 'element', pageId, type: 'stroke', createdBy: 'forged', zIndex: 1, data: {
    points: [{ x: 1, y: 2 }, { x: 2, y: 3 }], bounds: { x: 0, y: 0, width: 2, height: 3 },
    style: { color: 'red', width: 1, opacity: 1, lineCap: 'round', lineJoin: 'round' },
} });
const mutation = (pageId = 'page', type = 'update') => ({ type, pageId, elementId: 'element', timestamp: 1, data: element(pageId) }) as any;
function adapter(existing: any = { id: 'element', pageId: 'page' }) {
    const write = vi.fn();
    const config: any = {
        board: { findUnique: async () => ({ id: 'board', ownerId: 'user' }) },
        page: { findUnique: async ({ where }: any) => ({ id: where.id, boardId: where.id === 'page' ? 'board' : 'victim' }), delete: write },
        element: { findUnique: async () => existing, update: write, create: write, deleteMany: write },
        boardMember: {}, shareLink: {},
    };
    const storage = new PrismaBoardAdapter(config);
    config.transaction = async (work: any) => work(storage);
    return { storage, write, config };
}

describe('security persistence boundaries', () => {
    it.each(['read', 'delete', 'reorder'])('rejects hostile REST parent-child mismatch (%s)', async (op) => {
        const { storage, write } = adapter();
        const service = new BoardService(storage, {} as any);
        const task = op === 'read' ? service.getPageElements('foreign', 'board') :
            op === 'delete' ? service.deletePage('foreign', 'board') : service.reorderPages('board', ['foreign']);
        await expect(task).rejects.toThrow('Page does not belong');
        expect(write).not.toHaveBeenCalled();
    });
    it.each(['update', 'delete', 'create'])('rejects hostile websocket foreign page (%s) before persistence', async type => {
        const { storage, write } = adapter();
        await expect(storage.applyScopedMutations('board', 'user', [mutation('foreign', type)])).rejects.toThrow('Foreign page');
        expect(write).not.toHaveBeenCalled();
    });
    it.each(['update','delete','create'])('rejects global element ID collisions (%s)', async type => {
        const { storage, write } = adapter({ id: 'element', pageId: 'victim-page' });
        await expect(storage.applyScopedMutations('board','user',[mutation('page',type)])).rejects.toThrow('Foreign element');
        expect(write).not.toHaveBeenCalled();
    });
    it('prevalidates whole batches before any write', async () => {
        const { storage, write } = adapter();
        await expect(storage.applyScopedMutations('board','user',[mutation(),mutation('foreign')])).rejects.toThrow();
        expect(write).not.toHaveBeenCalled();
    });
    it('writes scoped predicates and derives author from identity', async () => {
        const { storage, write } = adapter(null);
        await storage.applyScopedMutations('board','user',[mutation('page','create')]);
        expect(write.mock.calls[0][0].data.createdBy).toBe('user');
        const update = adapter();
        await update.storage.applyScopedMutations('board','user',[mutation()]);
        expect(update.write.mock.calls[0][0].where).toEqual({ id:'element', pageId:'page', page:{boardId:'board'} });
    });
    it('discards ownership and archive mass assignment at service boundary', async () => {
        const storage = { updateBoard: vi.fn().mockResolvedValue({}) };
        const svc = new BoardService(storage as any, { getLatestSequence: async () => 0, append: async () => {} } as any);
        await svc.updateBoard('board', { name:'safe', ownerId:'attacker', isArchived:true }, 'editor');
        expect(storage.updateBoard).toHaveBeenCalledWith('board',{name:'safe'});
    });
    it('rejects runtime discriminators, nested identity, count and geometry attacks', () => {
        for (const input of [[mutation('page','bad')], [{...mutation(),data:element('victim')}], Array(201).fill(mutation())]) {
            expect(() => validateMutations(input as any,'user')).toThrow();
        }
        const m = mutation(); m.data.data.bounds.width = '1" onload="x';
        expect(() => validateMutations([m],'user')).toThrow();
        const valid = mutation(); validateMutations([valid], 'user');
        expect(valid.data.createdBy).toBe('user');
    });
    it('rejects stored SVG attribute payloads and excessive raster allocations', async () => {
        const bad = element(); bad.data.style.lineCap = 'round" onload="x';
        expect(() => validateRenderable(bad)).toThrow();
        const huge = element(); huge.createdBy = 'user'; huge.data.bounds.width = 1e7;
        const service = new ExportService({ getPages: async () => [{id:'page'}], getElements: async () => [huge] } as any);
        const canvas = vi.fn(); service.setCanvasFactory({createCanvas:canvas});
        await expect(service.exportBoard('board','png')).rejects.toThrow('pixel limit');
        expect(canvas).not.toHaveBeenCalled();
    });
    it('uses actual asset bytes and rejects active SVG uploads', async () => {
        const storage = { getBoardUsage: async () => 0, upload: vi.fn() };
        const service = new AssetService(storage as any, {maxAssetSizeMb:1});
        await expect(service.upload('board',Buffer.alloc(1024*1024+1),{mimeType:'image/png',sizeBytes:0,uploadedBy:'user'})).rejects.toThrow();
        await expect(service.upload('board',Buffer.from('<svg/>'),{mimeType:'image/svg+xml',sizeBytes:0,uploadedBy:'user'})).rejects.toThrow();
        expect(storage.upload).not.toHaveBeenCalled();
    });
    it('denies soft-deleted boards even to owners and private shares to anonymous users', async () => {
        const {storage,config} = adapter();
        config.isBoardAccessible = async () => false;
        const perms = new PermissionService(storage);
        expect(await perms.checkAccess('board','user','viewer')).toBe(false);
        config.shareLink.findFirst = async () => ({boardId:'board',permission:'view'});
        expect(await perms.resolveShareLink('token')).toBeNull();
        config.isBoardAccessible = async () => true;
        config.canUseShare = async (_:string,user?:string) => !!user;
        expect(await perms.resolveShareLink('token')).toBeNull();
        expect(await perms.resolveShareLink('token','user')).toEqual({boardId:'board',permission:'view'});
    });
    it('does not downgrade authenticated-share policy when bearer is absent', async () => {
        const resolve = vi.fn().mockResolvedValue(null);
        const controller = new AssetController({} as any, {} as any, {resolveShareLink:resolve} as any);
        await expect(controller.getAsset({headers:{'x-share-token':'private'}},{} as any,'board','asset')).rejects.toThrow();
        expect(resolve).toHaveBeenCalledWith('private',undefined);
    });
});

describe('live revocation', () => {
    it.each(['session','membership'])('blocks inbound writes and outbound data after %s revocation', async reason => {
        const relay = new SyncRelay();
        const socket = { id:'socket', emit:vi.fn(), disconnect:vi.fn(), leave:vi.fn() };
        const collaboration = { applyMutations:vi.fn(),leaveSession:vi.fn() };
        const gateway = new BoardGateway(collaboration as any,
            {validateConnection:async()=>reason==='session'?null:{userId:'user'}} as any,
            {checkAccess:async()=>false} as any,
            {removeParticipant:vi.fn()} as any, relay, {} as any);
        (gateway as any).clientBoardMap.set('socket','board');
        (gateway as any).clientUserMap.set('socket','user');
        (gateway as any).credentials.set('socket','token');
        relay.registerClient('socket',socket,'board',()=> (gateway as any).authorize(socket,'viewer'));
        relay.broadcast('board',{type:'participant:left',userId:'other'});
        await vi.waitFor(()=>expect(socket.disconnect).toHaveBeenCalled());
        expect(socket.emit).not.toHaveBeenCalled();
        await gateway.handleMutate(socket as any,{mutations:[mutation()],requestId:'req'} as any);
        expect(collaboration.applyMutations).not.toHaveBeenCalled();
        expect(socket.leave).toHaveBeenCalledWith('board');
    });
});
