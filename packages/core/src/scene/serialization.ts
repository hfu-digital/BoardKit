import type { Board, Page } from '../types/board';
import type { Element } from '../types/elements';

export function serializeBoard(
    board: Board,
    pages: Page[],
    elements: Map<string, Element[]>,
): string {
    const elementsObj: Record<string, Element[]> = {};
    for (const [pageId, pageElements] of elements) {
        elementsObj[pageId] = pageElements;
    }
    return JSON.stringify({ board, pages, elements: elementsObj });
}

export function deserializeBoard(json: string): {
    board: Board;
    pages: Page[];
    elements: Map<string, Element[]>;
} {
    const data = JSON.parse(json);

    if (!data.board || !data.pages || !data.elements) {
        throw new Error('Invalid board data: missing required fields');
    }

    const elements = new Map<string, Element[]>();
    for (const [pageId, pageElements] of Object.entries(data.elements)) {
        if (!Array.isArray(pageElements)) {
            throw new Error(`Invalid elements for page ${pageId}`);
        }
        elements.set(pageId, pageElements as Element[]);
    }

    return {
        board: data.board as Board,
        pages: data.pages as Page[],
        elements,
    };
}
