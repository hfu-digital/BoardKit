import type { BoardEvent, BoardSnapshot } from '@hfu.digital/boardkit-core';

export abstract class EventLogStorage {
    abstract append(event: Omit<BoardEvent, 'id'>): Promise<BoardEvent>;
    abstract appendBatch(
        events: Omit<BoardEvent, 'id'>[],
    ): Promise<BoardEvent[]>;
    abstract getEvents(
        boardId: string,
        afterSequence?: number,
    ): Promise<BoardEvent[]>;
    abstract getLatestSequence(boardId: string): Promise<number>;
    abstract createSnapshot(
        boardId: string,
        data: Record<string, unknown>,
        eventSequence: number,
    ): Promise<BoardSnapshot>;
    abstract getLatestSnapshot(
        boardId: string,
    ): Promise<BoardSnapshot | null>;
}
