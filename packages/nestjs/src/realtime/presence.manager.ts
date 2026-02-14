import { Injectable } from '@nestjs/common';
import type { Participant, Point } from '@boardkit/core';

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

    setTtl(ttlMs: number): void {
        this.presenceTtlMs = ttlMs;
    }

    addParticipant(boardId: string, participant: Participant): void {
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
    }
}
