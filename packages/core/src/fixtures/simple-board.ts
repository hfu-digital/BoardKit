import type { Board, Page } from '../types/board';
import type {
    Element,
    StrokeElement,
    ShapeElement,
    TextElement,
} from '../types/elements';
import { DEFAULT_STROKE_STYLE, DEFAULT_FILL_STYLE, DEFAULT_TEXT_STYLE } from '../constants';
import type { BoardFixture } from './empty-board';

export function createSimpleBoard(): BoardFixture {
    const now = new Date().toISOString();
    const board: Board = {
        id: 'board-simple-1',
        name: 'Simple Board',
        ownerId: 'user-1',
        sessionType: 'persistent',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
    };

    const page1: Page = {
        id: 'page-simple-1',
        boardId: board.id,
        name: 'Page 1',
        order: 0,
        createdAt: now,
        updatedAt: now,
    };

    const page2: Page = {
        id: 'page-simple-2',
        boardId: board.id,
        name: 'Page 2',
        order: 1,
        createdAt: now,
        updatedAt: now,
    };

    const page1Elements: Element[] = [
        // Strokes
        ...Array.from({ length: 4 }, (_, i): StrokeElement => ({
            id: `stroke-${i}`,
            pageId: page1.id,
            type: 'stroke',
            zIndex: i,
            createdBy: 'user-1',
            createdAt: now,
            updatedAt: now,
            data: {
                points: [
                    { x: i * 50, y: i * 30 },
                    { x: i * 50 + 100, y: i * 30 + 50 },
                    { x: i * 50 + 200, y: i * 30 },
                ],
                style: { ...DEFAULT_STROKE_STYLE },
                bounds: {
                    x: i * 50,
                    y: i * 30,
                    width: 200,
                    height: 50,
                },
            },
        })),
        // Shapes
        ...Array.from({ length: 3 }, (_, i): ShapeElement => ({
            id: `shape-${i}`,
            pageId: page1.id,
            type: 'shape',
            zIndex: 4 + i,
            createdBy: 'user-1',
            createdAt: now,
            updatedAt: now,
            data: {
                shapeType: (['rectangle', 'ellipse', 'triangle'] as const)[i],
                position: { x: 300 + i * 120, y: 100 },
                size: { width: 100, height: 80 },
                rotation: 0,
                style: {
                    stroke: { ...DEFAULT_STROKE_STYLE },
                    fill: { ...DEFAULT_FILL_STYLE, type: 'solid', color: '#4A90D9' },
                },
                bounds: {
                    x: 300 + i * 120,
                    y: 100,
                    width: 100,
                    height: 80,
                },
            },
        })),
    ];

    const page2Elements: Element[] = [
        // Text elements
        ...Array.from({ length: 3 }, (_, i): TextElement => ({
            id: `text-${i}`,
            pageId: page2.id,
            type: 'text',
            zIndex: i,
            createdBy: 'user-1',
            createdAt: now,
            updatedAt: now,
            data: {
                content: `Text block ${i + 1}`,
                position: { x: 50, y: 50 + i * 60 },
                size: { width: 200, height: 40 },
                rotation: 0,
                style: { ...DEFAULT_TEXT_STYLE },
                bounds: {
                    x: 50,
                    y: 50 + i * 60,
                    width: 200,
                    height: 40,
                },
            },
        })),
    ];

    const elements = new Map<string, Element[]>();
    elements.set(page1.id, page1Elements);
    elements.set(page2.id, page2Elements);

    return { board, pages: [page1, page2], elements };
}
