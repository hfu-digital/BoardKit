import { describe, it, expect, vi } from 'vitest';
import { SyncRelay } from './sync-relay';
import { PresenceManager } from './presence.manager';
import { BoardGateway } from './board.gateway';

const message = { type: 'participant:left' as const, userId: 'user' };
describe('SyncRelay lifetime and routing', () => {
    it('isolates boards, excludes senders, moves clients and releases empty boards', () => {
        const relay = new SyncRelay();
        const a = { emit: vi.fn() }, b = { emit: vi.fn() }, c = { emit: vi.fn() };
        relay.registerClient('a', a, 'one');
        relay.registerClient('b', b, 'one');
        relay.registerClient('c', c, 'two');
        relay.broadcast('one', message, 'a');
        expect(a.emit).not.toHaveBeenCalled();
        expect(b.emit).toHaveBeenCalledTimes(1);
        expect(c.emit).not.toHaveBeenCalled();
        relay.registerClient('b', b, 'two');
        relay.broadcast('one', message);
        expect(b.emit).toHaveBeenCalledTimes(1);
        relay.unregisterClient('a');
        relay.unregisterClient('a');
        relay.sendTo('a', message);
        expect(a.emit).toHaveBeenCalledTimes(1);
        expect((relay as any).boardClients.has('one')).toBe(false);
        relay.broadcast('two', message);
        expect(b.emit).toHaveBeenCalledTimes(2);
        expect(c.emit).toHaveBeenCalledTimes(1);
    });
    it('unregisters disconnected sockets even when session cleanup rejects', async () => {
        const relay = new SyncRelay();
        const socket = { id: 'socket', emit: vi.fn(), leave: vi.fn() };
        const gateway = new BoardGateway({ leaveSession: vi.fn().mockRejectedValue(new Error('offline')) } as any, {} as any, {} as any, new PresenceManager(), relay, {} as any);
        relay.registerClient(socket.id, socket, 'board');
        (gateway as any).clientBoardMap.set(socket.id, 'board');
        (gateway as any).clientUserMap.set(socket.id, 'user');
        await expect(gateway.handleDisconnect(socket as any)).rejects.toThrow('offline');
        expect((gateway as any).clientBoardMap.size).toBe(0);
        expect((gateway as any).clientUserMap.size).toBe(0);
        relay.broadcast('board', message);
        expect(socket.emit).not.toHaveBeenCalled();
    });
});
