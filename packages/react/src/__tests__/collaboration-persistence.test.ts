import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BoardStore } from '../store/board-store';
import { hydrateScene } from '../store/scene-sync';
const mock = vi.hoisted(() => ({ handlers: {} as Record<string, Function>, socket: { connected: true, emit: vi.fn(), on: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn() } }));
vi.mock('socket.io-client', () => ({ io: () => mock.socket }));
vi.mock('../context/BoardKitProvider', () => ({ useBoardKit: vi.fn() }));
import { CollaborationRuntime } from '../hooks/useCollaboration';
const page = (id: string) => ({ id, boardId: 'b', name: id, order: 0, createdAt: '', updatedAt: '' });
const element = (id: string, pageId: string) => ({ id, pageId, type: 'shape', zIndex: 1, data: {}, createdBy: 'u', createdAt: '', updatedAt: '' }) as any;
const create = (id: string, pageId = 'a') => ({ type: 'create', elementId: id, pageId, data: element(id,pageId), timestamp: 1 }) as any;
describe('all-page hydration and acknowledged persistence', () => {
    beforeEach(() => { vi.useFakeTimers(); mock.socket.emit.mockClear(); mock.socket.on.mockImplementation((name, fn) => { mock.handlers[name] = fn; }); });
    afterEach(() => vi.useRealTimers());
    it('loads every page and preserves pending changes without duplicate order entries', () => {
        const store = new BoardStore(); store.enqueueOutboundMutations([create('local')]);
        hydrateScene(store, { pages: [page('a'),page('b')], elements: { a:[element('one','a')], b:[element('two','b')] } });
        expect([...store.getState().scene.elements.keys()]).toEqual(['one','two','local']);
        store.setActivePageId('b'); expect(store.getState().scene.elements.has('two')).toBe(true);
        hydrateScene(store, { pages: [page('a')], elements: { a:[element('local','a')] } });
        expect(store.getState().activePageId).toBe('a');
        expect(store.getState().scene.elementOrder).toEqual(['local']);
        expect(store.getState().isHydrated).toBe(true);
    });
    it('waits for sync after joined; retains unacked edits through timeout/retry/reconnect', () => {
        const store = new BoardStore(); const runtime = new CollaborationRuntime(store,'b');
        runtime.start({apiUrl:'/api',wsUrl:'http://localhost'});
        mock.handlers.connect(); mock.handlers.message({ type:'joined', participants:[],currentSequence:0 });
        runtime.sendMutations([create('local')]); vi.advanceTimersByTime(60);
        expect(mock.socket.emit.mock.calls.filter(c=>c[0]==='mutate')).toHaveLength(0);
        mock.handlers.message({type:'sync:full',boardData:{pages:[page('a')],elements:{}},currentSequence:0});
        vi.advanceTimersByTime(60);
        const sent = mock.socket.emit.mock.calls.find(c=>c[0]==='mutate')![1];
        expect(runtime.snapshot().saveState).toBe('saving');
        vi.advanceTimersByTime(10001); expect(runtime.snapshot().saveState).toBe('error');
        runtime.retryPending(); expect(mock.socket.emit.mock.calls.at(-1)?.[1].requestId).toBe(sent.requestId);
        mock.handlers.disconnect(); expect(runtime.snapshot().pendingCount).toBe(1);
        mock.handlers.connect(); mock.handlers.message({type:'sync:full',boardData:{pages:[page('a')],elements:{}},currentSequence:0}); vi.advanceTimersByTime(60);
        expect(store.getState().scene.elements.has('local')).toBe(true);
        mock.handlers.message({type:'mutation:ack',requestId:'foreign',sequence:1}); expect(runtime.snapshot().pendingCount).toBe(1);
        mock.handlers.message({type:'mutation:ack',requestId:sent.requestId,sequence:1}); expect(runtime.snapshot().saveState).toBe('saved');
        runtime.stop();
    });
    it('splits valid UTF8-heavy mutations by encoded bytes, and keeps oversized edits visible', () => {
        const store = new BoardStore(); const runtime = new CollaborationRuntime(store,'b');
        runtime.start({apiUrl:'/api',wsUrl:'http://localhost'});
        mock.handlers.connect();
        mock.handlers.message({type:'sync:full',boardData:{pages:[page('a')],elements:{}},currentSequence:0});
        const large = (id:string, count=4) => {
            const m=create(id); m.data.data.metadata=Object.fromEntries(Array.from({length:count},(_,i)=>[String(i),'é'.repeat(90000)])); return m;
        };
        runtime.sendMutations([large('one'),large('two')]); vi.advanceTimersByTime(60);
        let sent=mock.socket.emit.mock.calls.filter(c=>c[0]==='mutate');
        expect(sent).toHaveLength(1); expect(sent[0][1].mutations).toHaveLength(1);
        expect(new TextEncoder().encode(JSON.stringify(sent[0][1].mutations)).byteLength).toBeLessThanOrEqual(1024*1024);
        mock.handlers.message({type:'mutation:ack',requestId:sent[0][1].requestId,sequence:1}); vi.advanceTimersByTime(60);
        sent=mock.socket.emit.mock.calls.filter(c=>c[0]==='mutate'); expect(sent).toHaveLength(2);
        mock.handlers.message({type:'mutation:ack',requestId:sent[1][1].requestId,sequence:2});
        const huge=large('huge',7); store.updateScene(scene=>({elements:new Map([...scene.elements,['huge',huge.data]]),elementOrder:[...scene.elementOrder,'huge']}));
        runtime.sendMutations([huge,create('after')]); vi.advanceTimersByTime(60);
        sent=mock.socket.emit.mock.calls.filter(c=>c[0]==='mutate'); expect(sent.at(-1)![1].mutations[0].elementId).toBe('after');
        expect(runtime.snapshot().saveState).toBe('error');
        expect(store.getState().scene.elements.has('huge')).toBe(true);
        mock.handlers.message({type:'mutation:ack',requestId:sent.at(-1)![1].requestId,sequence:3});
        expect(runtime.snapshot().pendingCount).toBe(1); expect(runtime.snapshot().saveState).toBe('error');
        runtime.stop();
    });

});
