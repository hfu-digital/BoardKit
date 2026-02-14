import type {
    Board,
    Page,
    Element,
    BoardMember,
    ShareLink,
} from '@boardkit/core';
import {
    BoardStorage,
    type CreateBoardInput,
    type CreatePageInput,
    type BoardFilters,
    type ElementUpsert,
} from '../interfaces/board-storage.interface';

let idCounter = 0;
function generateId(): string {
    return `test-${++idCounter}-${Date.now()}`;
}

export class InMemoryBoardStorage extends BoardStorage {
    private boards = new Map<string, Board>();
    private pages = new Map<string, Page>();
    private elements = new Map<string, Element[]>();
    private members = new Map<string, BoardMember[]>();
    private shareLinks = new Map<string, ShareLink>();

    // Board CRUD
    async createBoard(data: CreateBoardInput): Promise<Board> {
        const now = new Date().toISOString();
        const board: Board = {
            id: generateId(),
            name: data.name,
            ownerId: data.ownerId,
            sessionType: data.sessionType ?? 'persistent',
            isArchived: false,
            createdAt: now,
            updatedAt: now,
        };
        this.boards.set(board.id, board);
        return board;
    }

    async getBoard(id: string): Promise<Board | null> {
        return this.boards.get(id) ?? null;
    }

    async listBoards(filters: BoardFilters): Promise<Board[]> {
        let results = Array.from(this.boards.values());
        if (filters.ownerId !== undefined) {
            results = results.filter((b) => b.ownerId === filters.ownerId);
        }
        if (filters.isArchived !== undefined) {
            results = results.filter(
                (b) => b.isArchived === filters.isArchived,
            );
        }
        if (filters.sessionType !== undefined) {
            results = results.filter(
                (b) => b.sessionType === filters.sessionType,
            );
        }
        return results;
    }

    async updateBoard(id: string, data: Partial<Board>): Promise<Board> {
        const board = this.boards.get(id);
        if (!board) throw new Error(`Board ${id} not found`);
        const updated = {
            ...board,
            ...data,
            id,
            updatedAt: new Date().toISOString(),
        };
        this.boards.set(id, updated);
        return updated;
    }

    async deleteBoard(id: string): Promise<void> {
        this.boards.delete(id);
        // Clean up related data
        for (const [pageId, page] of this.pages) {
            if (page.boardId === id) {
                this.pages.delete(pageId);
                this.elements.delete(pageId);
            }
        }
        this.members.delete(id);
        for (const [linkId, link] of this.shareLinks) {
            if (link.boardId === id) {
                this.shareLinks.delete(linkId);
            }
        }
    }

    // Page operations
    async createPage(boardId: string, data: CreatePageInput): Promise<Page> {
        const now = new Date().toISOString();
        const page: Page = {
            id: generateId(),
            boardId,
            name: data.name ?? 'Untitled Page',
            order: data.order,
            createdAt: now,
            updatedAt: now,
        };
        this.pages.set(page.id, page);
        this.elements.set(page.id, []);
        return page;
    }

    async getPages(boardId: string): Promise<Page[]> {
        return Array.from(this.pages.values())
            .filter((p) => p.boardId === boardId)
            .sort((a, b) => a.order - b.order);
    }

    async getPage(id: string): Promise<Page | null> {
        return this.pages.get(id) ?? null;
    }

    async reorderPages(boardId: string, pageIds: string[]): Promise<void> {
        for (let i = 0; i < pageIds.length; i++) {
            const page = this.pages.get(pageIds[i]);
            if (page && page.boardId === boardId) {
                this.pages.set(pageIds[i], {
                    ...page,
                    order: i,
                    updatedAt: new Date().toISOString(),
                });
            }
        }
    }

    async deletePage(id: string): Promise<void> {
        this.pages.delete(id);
        this.elements.delete(id);
    }

    // Element operations
    async upsertElements(
        pageId: string,
        elements: ElementUpsert[],
    ): Promise<void> {
        const existing = this.elements.get(pageId) ?? [];
        const existingMap = new Map(existing.map((e) => [e.id, e]));

        for (const upsert of elements) {
            const now = new Date().toISOString();
            const prev = existingMap.get(upsert.id);
            existingMap.set(upsert.id, {
                id: upsert.id,
                pageId: upsert.pageId,
                type: upsert.type as Element['type'],
                data: upsert.data,
                zIndex: upsert.zIndex,
                createdBy: upsert.createdBy,
                createdAt: prev?.createdAt ?? now,
                updatedAt: now,
            } as Element);
        }

        this.elements.set(pageId, Array.from(existingMap.values()));
    }

    async getElements(pageId: string): Promise<Element[]> {
        return this.elements.get(pageId) ?? [];
    }

    async deleteElements(ids: string[]): Promise<void> {
        const idSet = new Set(ids);
        for (const [pageId, elems] of this.elements) {
            this.elements.set(
                pageId,
                elems.filter((e) => !idSet.has(e.id)),
            );
        }
    }

    // Permissions
    async setMember(
        boardId: string,
        userId: string,
        role: string,
    ): Promise<void> {
        const members = this.members.get(boardId) ?? [];
        const existing = members.find((m) => m.userId === userId);
        if (existing) {
            existing.role = role as BoardMember['role'];
        } else {
            members.push({
                boardId,
                userId,
                role: role as BoardMember['role'],
                joinedAt: new Date().toISOString(),
            });
        }
        this.members.set(boardId, members);
    }

    async getMembers(boardId: string): Promise<BoardMember[]> {
        return this.members.get(boardId) ?? [];
    }

    async getMemberRole(
        boardId: string,
        userId: string,
    ): Promise<string | null> {
        const members = this.members.get(boardId) ?? [];
        const member = members.find((m) => m.userId === userId);
        return member?.role ?? null;
    }

    async removeMember(boardId: string, userId: string): Promise<void> {
        const members = this.members.get(boardId) ?? [];
        this.members.set(
            boardId,
            members.filter((m) => m.userId !== userId),
        );
    }

    // Share links
    async createShareLink(data: {
        boardId: string;
        permission: 'view' | 'edit';
        expiresAt?: string;
    }): Promise<ShareLink> {
        const link: ShareLink = {
            id: generateId(),
            boardId: data.boardId,
            token: `token-${generateId()}`,
            permission: data.permission,
            expiresAt: data.expiresAt,
            createdAt: new Date().toISOString(),
        };
        this.shareLinks.set(link.id, link);
        return link;
    }

    async resolveShareLink(token: string): Promise<ShareLink | null> {
        for (const link of this.shareLinks.values()) {
            if (link.token === token) {
                if (
                    link.expiresAt &&
                    new Date(link.expiresAt) < new Date()
                ) {
                    return null;
                }
                return link;
            }
        }
        return null;
    }

    async deleteShareLink(id: string): Promise<void> {
        this.shareLinks.delete(id);
    }
}
