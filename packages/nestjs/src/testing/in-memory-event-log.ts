import type { BoardEvent, BoardSnapshot } from '@hfu.digital/boardkit-core';
import { EventLogStorage } from '../interfaces/event-log-storage.interface';

let idCounter = 0;
function generateId(): string {
    return `evt-${++idCounter}-${Date.now()}`;
}

export class InMemoryEventLogStorage extends EventLogStorage {
    private events = new Map<string, BoardEvent[]>();
    private sequences = new Map<string, number>();
    private snapshots = new Map<string, BoardSnapshot[]>();

    async append(event: Omit<BoardEvent, 'id'>): Promise<BoardEvent> {
        const boardEvents = this.events.get(event.boardId) ?? [];
        const sequence =
            (this.sequences.get(event.boardId) ?? 0) + 1;
        this.sequences.set(event.boardId, sequence);

        const fullEvent: BoardEvent = {
            ...event,
            id: generateId(),
            sequence,
        };
        boardEvents.push(fullEvent);
        this.events.set(event.boardId, boardEvents);
        return fullEvent;
    }

    async appendBatch(
        events: Omit<BoardEvent, 'id'>[],
    ): Promise<BoardEvent[]> {
        const results: BoardEvent[] = [];
        for (const event of events) {
            results.push(await this.append(event));
        }
        return results;
    }

    async getEvents(
        boardId: string,
        afterSequence?: number,
    ): Promise<BoardEvent[]> {
        const boardEvents = this.events.get(boardId) ?? [];
        if (afterSequence !== undefined) {
            return boardEvents.filter((e) => e.sequence > afterSequence);
        }
        return [...boardEvents];
    }

    async getLatestSequence(boardId: string): Promise<number> {
        return this.sequences.get(boardId) ?? 0;
    }

    async createSnapshot(
        boardId: string,
        data: Record<string, unknown>,
        eventSequence: number,
    ): Promise<BoardSnapshot> {
        const snapshot: BoardSnapshot = {
            id: generateId(),
            boardId,
            snapshotData: data,
            eventSequence,
            createdAt: new Date().toISOString(),
        };
        const snapshots = this.snapshots.get(boardId) ?? [];
        snapshots.push(snapshot);
        this.snapshots.set(boardId, snapshots);
        return snapshot;
    }

    async getLatestSnapshot(
        boardId: string,
    ): Promise<BoardSnapshot | null> {
        const snapshots = this.snapshots.get(boardId) ?? [];
        if (snapshots.length === 0) return null;
        return snapshots[snapshots.length - 1];
    }
}
