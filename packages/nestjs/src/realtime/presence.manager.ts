import { Injectable } from '@nestjs/common';
import type { Participant, Point } from '@hfu.digital/boardkit-core';

interface PresenceEntry {
    participant: Participant;
    cursorPosition?: Point;
    cursorPageId?: string;
    lastSeen: number;
}

@Injectable()
export class PresenceManager {
    private boards = new Map<string, Map<string, PresenceEntry>>();
    private presenceTtlMs = 30_000;

    private timer: ReturnType<typeof setInterval> | undefined;

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.boards.clear();
    }

    touch(boardId: string, userId: string): void {
        const entry = this.boards.get(boardId)?.get(userId);
        if (entry) entry.lastSeen = Date.now();
    }

    private startCleanup(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            for (const id of this.boards.keys()) this.pruneIdle(id);
            if (!this.boards.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
        }, Math.max(1, Math.min(this.presenceTtlMs, 30_000)));
        this.timer.unref?.();
    }

    setTtl(ttlMs: number): void {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Presence TTL must be positive');
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.presenceTtlMs = ttlMs;
        if (this.boards.size) this.startCleanup();
    }

    addParticipant(boardId: string, participant: Participant): void {
        this.startCleanup();
        if (!this.boards.has(boardId)) {
            this.boards.set(boardId, new Map());
        }
        this.boards.get(boardId)!.set(participant.userId, {
            participant,
            lastSeen: Date.now(),
        });
    }

    removeParticipant(boardId: string, userId: string): void {
        this.boards.get(boardId)?.delete(userId);
        if (this.boards.get(boardId)?.size === 0) {
            this.boards.delete(boardId);
        }
    }

    updateCursor(boardId: string, userId: string, position: Point, pageId: string): void {
        const entry = this.boards.get(boardId)?.get(userId);
        if (entry) {
            entry.cursorPosition = position;
            entry.cursorPageId = pageId;
            entry.lastSeen = Date.now();
        }
    }

    getParticipants(boardId: string): Participant[] {
        const board = this.boards.get(boardId);
        if (!board) return [];
        this.pruneIdle(boardId);
        return Array.from(board.values()).map((e) => ({
            ...e.participant,
            cursorPosition: e.cursorPosition,
            activePageId: e.cursorPageId,
        }));
    }

    private pruneIdle(boardId: string): void {
        const board = this.boards.get(boardId);
        if (!board) return;
        const now = Date.now();
        for (const [userId, entry] of board) {
            if (now - entry.lastSeen > this.presenceTtlMs) {
                board.delete(userId);
            }
        }
        if (!board.size) this.boards.delete(boardId);
    }
}
