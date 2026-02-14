import type { Element, Point } from '../types/elements';
import type { CursorPosition } from '../types/collaboration';
import type { Rect } from '../types/elements';

export interface RenderContext {
    viewport: { offset: Point; zoom: number };
    selectedIds: Set<string>;
    hoveredId?: string;
    activeTool: string;
}

export abstract class BoardRenderer {
    abstract initialize(container: HTMLElement): void;
    abstract resize(width: number, height: number): void;
    abstract renderStaticLayer(elements: Element[], context: RenderContext): void;
    abstract renderInteractiveLayer(
        preview: Element[],
        cursors: CursorPosition[],
        selections: Rect[],
        context: RenderContext,
    ): void;
    abstract destroy(): void;
    abstract toDataURL(format?: string, quality?: number): string;
}
