import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenceManager } from './presence.manager';
const participant = { userId: 'u', displayName: 'User', color: '#000', joinedAt: 'now' };
afterEach(() => vi.useRealTimers());
describe('presence resource cleanup', () => {
    it('prunes unread boards, stops its timer, and restarts for new presence', () => {
        vi.useFakeTimers();
        const presence = new PresenceManager(); presence.setTtl(100);
        presence.addParticipant('unread', participant);
        vi.advanceTimersByTime(201);
        expect(presence.getParticipants('unread')).toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
        presence.addParticipant('new', participant);
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(90); presence.touch('new', 'u');
        vi.advanceTimersByTime(90); expect(presence.getParticipants('new')).toHaveLength(1);
        presence.onModuleDestroy(); expect(vi.getTimerCount()).toBe(0);
        expect(presence.getParticipants('new')).toEqual([]);
    });
    it('validates TTL and reschedules an existing sweep', () => {
        vi.useFakeTimers(); const presence = new PresenceManager();
        expect(() => presence.setTtl(0)).toThrow(RangeError);
        presence.addParticipant('b', participant); presence.setTtl(10);
        vi.advanceTimersByTime(21); expect(vi.getTimerCount()).toBe(0);
        presence.onModuleDestroy();
    });
});
