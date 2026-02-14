import type { StrokeStyle, ShapeStyle, TextStyle } from './styles';

export type ElementType = 'stroke' | 'shape' | 'text' | 'image' | 'stickyNote' | 'group';

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ElementBase {
    id: string;
    pageId: string;
    type: ElementType;
    zIndex: number;
    lockedBy?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface StrokeElement extends ElementBase {
    type: 'stroke';
    data: {
        points: Point[];
        pressures?: number[];
        style: StrokeStyle;
        bounds: Rect;
    };
}

export interface ShapeElement extends ElementBase {
    type: 'shape';
    data: {
        shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'triangle';
        position: Point;
        size: { width: number; height: number };
        rotation: number;
        style: ShapeStyle;
        bounds: Rect;
    };
}

export interface TextElement extends ElementBase {
    type: 'text';
    data: {
        content: string;
        position: Point;
        size: { width: number; height: number };
        rotation: number;
        style: TextStyle;
        bounds: Rect;
    };
}

export interface ImageElement extends ElementBase {
    type: 'image';
    data: {
        assetId: string;
        url: string;
        position: Point;
        size: { width: number; height: number };
        rotation: number;
        bounds: Rect;
    };
}

export interface StickyNoteElement extends ElementBase {
    type: 'stickyNote';
    data: {
        content: string;
        position: Point;
        size: { width: number; height: number };
        color: string;
        style: TextStyle;
        bounds: Rect;
    };
}

export interface GroupElement extends ElementBase {
    type: 'group';
    data: {
        childIds: string[];
        bounds: Rect;
    };
}

export type Element =
    | StrokeElement
    | ShapeElement
    | TextElement
    | ImageElement
    | StickyNoteElement
    | GroupElement;
