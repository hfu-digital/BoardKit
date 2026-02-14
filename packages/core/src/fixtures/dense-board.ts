import type { Board, Page } from '../types/board';
import type { Element, StrokeElement } from '../types/elements';
import { DEFAULT_STROKE_STYLE } from '../constants';
import type { BoardFixture } from './empty-board';

export function createDenseBoard(elementCount = 2000): BoardFixture {
    const now = new Date().toISOString();
    const board: Board = {
        id: 'board-dense-1',
        name: 'Dense Board',
        ownerId: 'user-1',
        sessionType: 'persistent',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
    };

    const page: Page = {
        id: 'page-dense-1',
        boardId: board.id,
        name: 'Page 1',
        order: 0,
        createdAt: now,
        updatedAt: now,
    };

    const pageElements: Element[] = Array.from(
        { length: elementCount },
        (_, i): StrokeElement => {
            const row = Math.floor(i / 50);
            const col = i % 50;
            const x = col * 40;
            const y = row * 40;
            return {
                id: `dense-stroke-${i}`,
                pageId: page.id,
                type: 'stroke',
                zIndex: i,
                createdBy: 'user-1',
                createdAt: now,
                updatedAt: now,
                data: {
                    points: [
                        { x, y },
                        { x: x + 20, y: y + 10 },
                        { x: x + 30, y: y + 5 },
                    ],
                    style: { ...DEFAULT_STROKE_STYLE },
                    bounds: { x, y, width: 30, height: 10 },
                },
            };
        },
    );

    const elements = new Map<string, Element[]>();
    elements.set(page.id, pageElements);

    return { board, pages: [page], elements };
}

export function createStressBoard(): BoardFixture {
    return createDenseBoard(5000);
}
