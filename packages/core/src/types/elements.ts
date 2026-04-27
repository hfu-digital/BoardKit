import type { StrokeStyle, ShapeStyle, TextStyle } from './styles';

export type ElementType = 'stroke' | 'shape' | 'linear' | 'text' | 'image' | 'group';

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

/**
 * Freeform pen / pressure-sensitive stroke. Always rendered as smooth
 * vector — the Rough.js sketchy treatment doesn't apply to freedraw, since
 * it's already an organic stroke.
 */
export interface StrokeElement extends ElementBase {
    type: 'stroke';
    data: {
        points: Point[];
        pressures?: number[];
        style: StrokeStyle;
        bounds: Rect;
    };
}

/**
 * Closed geometric shape. The three sub-types (rectangle, diamond, ellipse)
 * share the bounding-box drag interaction, so they're modelled as one
 * element type with a `shapeType` discriminator instead of three.
 */
export interface ShapeElement extends ElementBase {
    type: 'shape';
    data: {
        shapeType: 'rectangle' | 'diamond' | 'ellipse';
        position: Point;
        size: { width: number; height: number };
        rotation: number;
        style: ShapeStyle;
        bounds: Rect;
    };
}

/**
 * Open polyline — used for both `line` and `arrow`. Excalidraw treats these
 * the same internally; only the optional arrowheads differ. `points` always
 * has at least 2 entries (start and end). Multi-segment polylines stay
 * supported for future polyline tools without breaking the schema.
 */
export interface LinearElement extends ElementBase {
    type: 'linear';
    data: {
        linearType: 'line' | 'arrow';
        points: Point[];
        rotation: number;
        style: StrokeStyle;
        roughness: 0 | 1 | 2;
        seed: number;
        arrowStart: boolean;
        arrowEnd: boolean;
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
    | LinearElement
    | TextElement
    | ImageElement
    | GroupElement;
