import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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
        if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200 || (data.sessionType !== undefined && !['persistent', 'ephemeral'].includes(data.sessionType))) throw new BadRequestException('Invalid board');
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
        if (!data || (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200))) throw new BadRequestException('Invalid board name');
        const changes = data.name === undefined ? {} : { name: data.name };
        const board = await this.storage.updateBoard(id, changes);
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
        if (data && ((data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200)) || !Number.isSafeInteger(data.order))) throw new BadRequestException('Invalid page');
        if (userId) {
            const committed = await this.storage.commitPageChange(boardId, userId, { type: 'add', ...data });
            if (committed) return committed.page!;
        }
        const pages = await this.storage.getPages(boardId);
        if (pages.length >= 100) throw new BadRequestException('Page limit exceeded');
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

    async renamePage(boardId: string, pageId: string, name: string, userId?: string): Promise<Page> {
        if (typeof name !== 'string' || !name.trim() || name.length > 200) throw new BadRequestException('Invalid page name');
        if (userId) {
            const committed = await this.storage.commitPageChange(boardId, userId, { type: 'rename', pageId, name: name.trim() });
            if (committed) return committed.page!;
        }
        await this.assertPage(boardId, pageId);
        return this.storage.renamePage(boardId, pageId, name.trim());
    }

    async reorderPages(
        boardId: string,
        pageIds: string[],
        userId?: string,
    ): Promise<void> {
        if (!Array.isArray(pageIds) || pageIds.length > 1000 || pageIds.some(id => typeof id !== 'string') || new Set(pageIds).size !== pageIds.length) throw new BadRequestException('Invalid page order');
        if (userId && await this.storage.commitPageChange(boardId, userId, { type: 'reorder', pageIds })) return;
        for (const pageId of pageIds) await this.assertPage(boardId, pageId);
        if ((await this.storage.getPages(boardId)).length !== pageIds.length) throw new BadRequestException('Complete page order required');
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
        if (userId && await this.storage.commitPageChange(boardId, userId, { type: 'delete', pageId })) return;
        await this.assertPage(boardId, pageId);
        await this.storage.deletePage(pageId, boardId);
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

    async assertPage(boardId: string, pageId: string): Promise<void> {
        const page = await this.storage.getPage(pageId);
        if (!page || page.boardId !== boardId) throw new ForbiddenException('Page does not belong to board');
    }

    async getPageElements(pageId: string, boardId?: string): Promise<Element[]> {
        if (boardId) await this.assertPage(boardId, pageId);
        return this.storage.getElements(pageId);
    }
}
