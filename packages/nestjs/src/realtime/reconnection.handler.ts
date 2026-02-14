import { Injectable } from '@nestjs/common';
import type { ElementMutation } from '@boardkit/core';
import { BoardStorage } from '../interfaces/board-storage.interface';

@Injectable()
export class ReconnectionHandler {
    constructor(private readonly storage: BoardStorage) {}

    async sendDelta(
        client: { emit: (event: string, data: any) => void },
        mutations: ElementMutation[],
        fromSequence: number,
        toSequence: number,
    ): Promise<void> {
        client.emit('message', {
            type: 'sync:delta',
            mutations,
            fromSequence,
            toSequence,
        });
    }

    async sendFullSync(
        client: { emit: (event: string, data: any) => void },
        boardId: string,
        currentSequence: number,
    ): Promise<void> {
        const board = await this.storage.getBoard(boardId);
        const pages = await this.storage.getPages(boardId);
        const elements: Record<string, any[]> = {};
        for (const page of pages) {
            elements[page.id] = await this.storage.getElements(page.id);
        }

        client.emit('message', {
            type: 'sync:full',
            boardData: { board, pages, elements },
            currentSequence,
        });
    }
}
