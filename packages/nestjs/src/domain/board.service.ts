import { Injectable } from '@nestjs/common';
import type { Board, Page, Element } from '@hfu.digital/boardkit-core';
import { BoardStorage, type CreateBoardInput, type CreatePageInput } from '../interfaces/board-storage.interface';
import { EventLogStorage } from '../interfaces/event-log-storage.interface';

@Injectable()
export class BoardService {
    constructor(
        private readonly storage: BoardStorage,
        private readonly eventLog: EventLogStorage,
    ) {}

    async createBoard(data: CreateBoardInput): Promise<Board> {
        const board = await this.storage.createBoard(data);
        // Create default first page
        await this.storage.createPage(board.id, {
            name: 'Page 1',
            order: 0,
        });
        // Log event
        await this.eventLog.append({
            boardId: board.id,
            type: 'boardUpdated',
            payload: { action: 'created', name: data.name },
            userId: data.ownerId,
            sequence: 1,
            timestamp: new Date().toISOString(),
        });
        return board;
    }

    async getBoard(id: string): Promise<Board> {
        const board = await this.storage.getBoard(id);
        if (!board) {
            throw new Error(`Board ${id} not found`);
        }
        return board;
    }

    async listBoards(userId: string): Promise<Board[]> {
        return this.storage.listBoards({
            ownerId: userId,
            isArchived: false,
        });
    }

    async updateBoard(
        id: string,
        data: Partial<Board>,
        userId: string,
    ): Promise<Board> {
        const board = await this.storage.updateBoard(id, data);
        const sequence = await this.eventLog.getLatestSequence(id);
        await this.eventLog.append({
            boardId: id,
            type: 'boardUpdated',
            payload: { action: 'updated', changes: data },
            userId,
            sequence: sequence + 1,
            timestamp: new Date().toISOString(),
        });
        return board;
    }

    async archiveBoard(id: string, userId: string): Promise<void> {
        await this.storage.updateBoard(id, { isArchived: true });
        const sequence = await this.eventLog.getLatestSequence(id);
        await this.eventLog.append({
            boardId: id,
            type: 'boardUpdated',
            payload: { action: 'archived' },
            userId,
            sequence: sequence + 1,
            timestamp: new Date().toISOString(),
        });
    }

    async deleteBoard(id: string): Promise<void> {
        await this.storage.deleteBoard(id);
    }

    // Page management
    async addPage(
        boardId: string,
        data?: CreatePageInput,
        userId?: string,
    ): Promise<Page> {
        const pages = await this.storage.getPages(boardId);
        const page = await this.storage.createPage(boardId, {
            name: data?.name ?? `Page ${pages.length + 1}`,
            order: data?.order ?? pages.length,
        });
        if (userId) {
            const sequence =
                await this.eventLog.getLatestSequence(boardId);
            await this.eventLog.append({
                boardId,
                pageId: page.id,
                type: 'pageAdded',
                payload: { pageId: page.id, name: page.name },
                userId,
                sequence: sequence + 1,
                timestamp: new Date().toISOString(),
            });
        }
        return page;
    }

    async getPages(boardId: string): Promise<Page[]> {
        return this.storage.getPages(boardId);
    }

    async reorderPages(
        boardId: string,
        pageIds: string[],
        userId?: string,
    ): Promise<void> {
        await this.storage.reorderPages(boardId, pageIds);
        if (userId) {
            const sequence =
                await this.eventLog.getLatestSequence(boardId);
            await this.eventLog.append({
                boardId,
                type: 'pageReordered',
                payload: { pageIds },
                userId,
                sequence: sequence + 1,
                timestamp: new Date().toISOString(),
            });
        }
    }

    async deletePage(
        pageId: string,
        boardId: string,
        userId?: string,
    ): Promise<void> {
        await this.storage.deletePage(pageId);
        if (userId) {
            const sequence =
                await this.eventLog.getLatestSequence(boardId);
            await this.eventLog.append({
                boardId,
                pageId,
                type: 'pageRemoved',
                payload: { pageId },
                userId,
                sequence: sequence + 1,
                timestamp: new Date().toISOString(),
            });
        }
    }

    async getPageElements(pageId: string): Promise<Element[]> {
        return this.storage.getElements(pageId);
    }
}
