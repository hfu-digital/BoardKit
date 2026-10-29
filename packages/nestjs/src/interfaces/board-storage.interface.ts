import type {
    Board,
    Page,
    Element,
    BoardMember,
    ShareLink,
} from '@hfu.digital/boardkit-core';

export interface CreateBoardInput {
    name: string;
    ownerId: string;
    sessionType?: 'ephemeral' | 'persistent';
}

export interface CreatePageInput {
    name?: string;
    order: number;
}

export interface BoardFilters {
    ownerId?: string;
    isArchived?: boolean;
    sessionType?: 'ephemeral' | 'persistent';
}

export interface ElementUpsert {
    id: string;
    pageId: string;
    type: string;
    data: Record<string, unknown>;
    zIndex: number;
    createdBy: string;
}

export abstract class BoardStorage {
    // Board CRUD
    abstract createBoard(data: CreateBoardInput): Promise<Board>;
    abstract getBoard(id: string): Promise<Board | null>;
    abstract listBoards(filters: BoardFilters): Promise<Board[]>;
    abstract updateBoard(id: string, data: Partial<Board>): Promise<Board>;
    abstract deleteBoard(id: string): Promise<void>;

    // Page operations
    abstract createPage(boardId: string, data: CreatePageInput): Promise<Page>;
    abstract getPages(boardId: string): Promise<Page[]>;
    abstract getPage(id: string): Promise<Page | null>;
    abstract reorderPages(boardId: string, pageIds: string[]): Promise<void>;
    abstract deletePage(id: string, boardId?: string): Promise<void>;

    // Element operations (batch-friendly for sync)
    abstract upsertElements(
        pageId: string,
        elements: ElementUpsert[],
    ): Promise<void>;
    abstract getElements(pageId: string): Promise<Element[]>;
    abstract deleteElements(ids: string[]): Promise<void>;

    /** Atomic, scoped persistence contract. Adapters must opt in; unsafe legacy writes fail closed. */
    async applyScopedMutations(boardId: string, userId: string, mutations: import('@hfu.digital/boardkit-core').ElementMutation[]): Promise<void> {
        throw new Error('Storage adapter must implement atomic scoped mutations');
    }

    /** Host policy hook for soft deletion/moderation and private shares. */
    async isBoardAccessible(boardId: string): Promise<boolean> {
        const board = await this.getBoard(boardId);
        return !!board && !board.isArchived;
    }
    async canUseShare(token: string, userId?: string): Promise<boolean> { return true; }

    // Permissions
    abstract setMember(
        boardId: string,
        userId: string,
        role: string,
    ): Promise<void>;
    abstract getMembers(boardId: string): Promise<BoardMember[]>;
    abstract getMemberRole(
        boardId: string,
        userId: string,
    ): Promise<string | null>;
    abstract removeMember(boardId: string, userId: string): Promise<void>;

    // Share links
    abstract createShareLink(data: {
        boardId: string;
        permission: 'view' | 'edit';
        expiresAt?: string;
    }): Promise<ShareLink>;
    abstract resolveShareLink(token: string): Promise<ShareLink | null>;
    abstract deleteShareLink(id: string): Promise<void>;
}
