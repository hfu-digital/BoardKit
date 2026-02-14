import type { Board, Page } from '../types/board';
import type { Element } from '../types/elements';

export interface BoardFixture {
    board: Board;
    pages: Page[];
    elements: Map<string, Element[]>;
}

export function createEmptyBoard(): BoardFixture {
    const now = new Date().toISOString();
    const board: Board = {
        id: 'board-empty-1',
        name: 'Empty Board',
        ownerId: 'user-1',
        sessionType: 'persistent',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
    };

    const page: Page = {
        id: 'page-empty-1',
        boardId: board.id,
        name: 'Page 1',
        order: 0,
        createdAt: now,
        updatedAt: now,
    };

    const elements = new Map<string, Element[]>();
    elements.set(page.id, []);

    return { board, pages: [page], elements };
}
