import { BoardGateway } from '../realtime/board.gateway';
import { describe, it, expect, vi } from 'vitest';
import { BoardService } from './board.service';
import { CollaborationService } from './collaboration.service';
import { PermissionService } from './permission.service';
import { InMemoryBoardStorage } from '../testing/in-memory-board-storage';
import { InMemoryEventLogStorage } from '../testing/in-memory-event-log';
import { PageController } from '../controllers/page.controller';
describe('persistent pages and role boundaries', () => {
    it('persists names/orders and rejects foreign page ids and commenter mutations', async () => {
        const storage = new InMemoryBoardStorage(); const log = new InMemoryEventLogStorage();
        const svc = new BoardService(storage,log); const permissions = new PermissionService(storage);
        const board = await svc.createBoard({name:'board',ownerId:'owner'});
        const foreign = await svc.createBoard({name:'other',ownerId:'owner'});
        const first = (await svc.getPages(board.id))[0]; const second = await svc.addPage(board.id,{name:'Second',order:1});
        await svc.renamePage(board.id,second.id,'Renamed'); await svc.reorderPages(board.id,[second.id,first.id]);
        expect((await svc.getPages(board.id)).map(p=>p.name)).toEqual(['Renamed','Page 1']);
        await expect(svc.renamePage(foreign.id,second.id,'bad')).rejects.toThrow();
        await expect(svc.reorderPages(board.id,[first.id])).rejects.toThrow();
        await storage.setMember(board.id,'commenter','commenter');
        expect(await permissions.checkAccess(board.id,'commenter','viewer')).toBe(true);
        expect(await permissions.checkAccess(board.id,'commenter','commenter')).toBe(true);
        expect(await permissions.checkAccess(board.id,'commenter','editor')).toBe(false);
        const controller = new PageController(svc,{validateRequest:async()=>({userId:'commenter'})} as any,permissions);
        await expect(controller.addPage({headers:{authorization:'Bearer x'}},board.id,{})).rejects.toThrow('Insufficient');
        await expect(controller.renamePage({headers:{authorization:'Bearer x'}},board.id,first.id,{name:'bad'})).rejects.toThrow('Insufficient');
        await svc.deletePage(second.id,board.id); expect(await svc.getPages(board.id)).toHaveLength(1);
    });
    it('coalesces retries and never separately appends after an atomic host commit', async () => {
        const storage = new InMemoryBoardStorage(); const log = new InMemoryEventLogStorage();
        const svc = new CollaborationService(storage,log);
        const commit = vi.spyOn(storage,'commitMutations').mockResolvedValue(42);
        const append = vi.spyOn(log,'append');
        const mutations = [{type:'delete',elementId:'e',pageId:'p',timestamp:1}] as any;
        expect(await Promise.all([svc.applyMutations('b','u',mutations,'request'),svc.applyMutations('b','u',mutations,'request')])).toEqual([42,42]);
        expect(commit).toHaveBeenCalledTimes(1); expect(append).not.toHaveBeenCalled();
        await expect(svc.applyMutations('b','u',[{...mutations[0],elementId:'different'}],'request')).rejects.toThrow('reused');
        await expect(svc.applyMutations('b','u',[{...mutations[0],type:'invalid'}],'new')).rejects.toThrow();
        expect(commit).toHaveBeenCalledTimes(1);
    });
    it('never rebroadcasts durable receipts from a second instance with a stale watermark', async () => {
        const storage = new InMemoryBoardStorage(); const log = new InMemoryEventLogStorage();
        let stored = false;
        vi.spyOn(storage,'commitMutations').mockImplementation(async () => {
            const replayed = stored; stored = true; return {sequence:10,replayed};
        });
        const mutations=[{type:'delete',elementId:'e',pageId:'p',timestamp:1}] as any;
        const first=new CollaborationService(storage,log);
        expect((await first.applyMutationsDetailed('b','u',mutations,'same')).replayed).toBe(false);
        const second=new CollaborationService(storage,log);
        const relay={broadcast:vi.fn()}; const socket={id:'s',emit:vi.fn()};
        const gateway=new BoardGateway(second,{validateConnection:async()=>({userId:'u'})} as any,{checkAccess:async()=>true} as any,{} as any,relay as any,{} as any);
        (gateway as any).clientBoardMap.set('s','b'); (gateway as any).clientUserMap.set('s','u');
        (gateway as any).clientRoleMap.set('s','editor'); (gateway as any).credentials.set('s','token');
        await gateway.handleMutate(socket as any,{mutations,requestId:'same'} as any);
        expect(socket.emit).toHaveBeenCalledWith('message',{type:'mutation:ack',requestId:'same',sequence:10});
        expect(relay.broadcast).not.toHaveBeenCalled();
    });

    it('delegates page mutations and event writes to the atomic host callback', async () => {
        const storage=new InMemoryBoardStorage(); const log=new InMemoryEventLogStorage();
        const service=new BoardService(storage,log);
        const page={id:'p',boardId:'b',name:'P',order:0,createdAt:'',updatedAt:''};
        const commit=vi.spyOn(storage,'commitPageChange').mockResolvedValue({page,pages:[page]});
        const append=vi.spyOn(log,'append'); const create=vi.spyOn(storage,'createPage');
        expect(await service.addPage('b',{name:'P',order:0},'u')).toEqual(page);
        await service.renamePage('b','p','New','u'); await service.reorderPages('b',['p'],'u'); await service.deletePage('p','b','u');
        expect(commit).toHaveBeenCalledTimes(4); expect(append).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
    });

});
