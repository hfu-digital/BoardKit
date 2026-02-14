import type { BoardEvent, BoardSnapshot } from '@boardkit/core';
import { EventLogStorage } from '../interfaces/event-log-storage.interface';

// Structural typing — NEVER import from @prisma/client
type PrismaEventDelegate = {
    create: (args: { data: any }) => Promise<any>;
    createMany: (args: { data: any[] }) => Promise<any>;
    findMany: (args: {
        where?: any;
        orderBy?: any;
    }) => Promise<any[]>;
    aggregate: (args: { where: any; _max?: any }) => Promise<any>;
};

type PrismaSnapshotDelegate = {
    create: (args: { data: any }) => Promise<any>;
    findFirst: (args: {
        where: any;
        orderBy?: any;
    }) => Promise<any>;
};

export interface PrismaEventLogAdapterConfig {
    boardEvent: PrismaEventDelegate;
    boardSnapshot: PrismaSnapshotDelegate;
}

export class PrismaEventLogAdapter extends EventLogStorage {
    constructor(
        private readonly prisma: PrismaEventLogAdapterConfig,
    ) {
        super();
    }

    async append(event: Omit<BoardEvent, 'id'>): Promise<BoardEvent> {
        return this.prisma.boardEvent.create({
            data: {
                boardId: event.boardId,
                pageId: event.pageId,
                type: event.type,
                payload: event.payload as any,
                userId: event.userId,
                sequence: event.sequence,
                timestamp: event.timestamp,
            },
        });
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
        const where: Record<string, unknown> = { boardId };
        if (afterSequence !== undefined) {
            where.sequence = { gt: afterSequence };
        }
        return this.prisma.boardEvent.findMany({
            where,
            orderBy: { sequence: 'asc' },
        });
    }

    async getLatestSequence(boardId: string): Promise<number> {
        const result = await this.prisma.boardEvent.aggregate({
            where: { boardId },
            _max: { sequence: true },
        });
        return result._max?.sequence ?? 0;
    }

    async createSnapshot(
        boardId: string,
        data: Record<string, unknown>,
        eventSequence: number,
    ): Promise<BoardSnapshot> {
        return this.prisma.boardSnapshot.create({
            data: {
                boardId,
                snapshotData: data as any,
                eventSequence,
            },
        });
    }

    async getLatestSnapshot(
        boardId: string,
    ): Promise<BoardSnapshot | null> {
        return this.prisma.boardSnapshot.findFirst({
            where: { boardId },
            orderBy: { eventSequence: 'desc' },
        });
    }
}
