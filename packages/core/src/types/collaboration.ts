import type { Point, Rect } from './elements';

export interface Participant {
    userId: string;
    displayName: string;
    color: string;
    cursorPosition?: Point;
    activePageId?: string;
    activeTool?: string;
    viewportBounds?: Rect;
    joinedAt: string;
}

export interface CursorPosition {
    userId: string;
    position: Point;
    pageId: string;
}
