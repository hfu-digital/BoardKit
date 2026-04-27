import type { Element, ShapeElement, LinearElement, TextElement, StrokeElement } from '@hfu.digital/boardkit-core';
import { DEFAULT_SHAPE_STYLE, DEFAULT_STROKE_STYLE, DEFAULT_TEXT_STYLE, generateRoughSeed } from '@hfu.digital/boardkit-core';

/**
 * Excalidraw library file format (.excalidrawlib v2).
 * See https://docs.excalidraw.com/docs/codebase/json-schema
 */
export interface ExcalidrawLibraryFile {
    type: 'excalidrawlib';
    version: 1 | 2;
    source?: string;
    libraryItems?: ExcalidrawLibraryItem[];
    /** Legacy v1 placed elements directly under `library`. */
    library?: ExcalidrawElement[][];
}

export interface ExcalidrawLibraryItem {
    id?: string;
    name?: string;
    status?: string;
    elements: ExcalidrawElement[];
    created?: number;
}

/** Subset of Excalidraw's element schema we actually consume. */
export interface ExcalidrawElement {
    id?: string;
    type:
        | 'rectangle' | 'diamond' | 'ellipse'
        | 'arrow' | 'line'
        | 'freedraw' | 'text';
    x: number;
    y: number;
    width?: number;
    height?: number;
    angle?: number;
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: 'solid' | 'hachure' | 'cross-hatch' | 'zigzag' | 'dots';
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    roughness?: 0 | 1 | 2;
    opacity?: number; // 0-100
    seed?: number;
    points?: [number, number][];
    text?: string;
    fontSize?: number;
    fontFamily?: number;
    textAlign?: 'left' | 'center' | 'right';
    pressures?: number[];
    [key: string]: unknown;
}

export interface ParsedLibrary {
    name: string;
    items: ParsedLibraryItem[];
}

export interface ParsedLibraryItem {
    id: string;
    name: string;
    /**
     * BoardKit Elements with positions normalised to (0,0) origin so the
     * caller can offset to the drop point. A library item is a *group* of
     * elements that travel together.
     */
    elements: Omit<Element, 'id' | 'pageId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'zIndex'>[];
    /** Bounding rect of the group, useful for thumbnail rendering. */
    bounds: { x: number; y: number; width: number; height: number };
}

export function parseExcalidrawLib(json: unknown, fallbackName = 'Library'): ParsedLibrary {
    const file = json as ExcalidrawLibraryFile;
    if (!file || file.type !== 'excalidrawlib') {
        throw new Error(`Expected an Excalidraw library file (.excalidrawlib); got type=${(file as any)?.type}`);
    }

    // v2 format
    let rawItems: ExcalidrawLibraryItem[] = file.libraryItems ?? [];
    // v1 fallback — `library` was an array of element arrays.
    if (rawItems.length === 0 && Array.isArray(file.library)) {
        rawItems = file.library.map((els, i) => ({ id: `legacy-${i}`, elements: els }));
    }

    const items: ParsedLibraryItem[] = rawItems.map((item, idx) => {
        const els = item.elements
            .map(convertElement)
            .filter((e): e is Omit<Element, 'id' | 'pageId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'zIndex'> => e !== null);

        // Compute bounding box and normalise positions to (0,0).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const e of els) {
            const b = (e.data as any).bounds;
            if (!b) continue;
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        if (!isFinite(minX)) {
            minX = 0; minY = 0; maxX = 0; maxY = 0;
        }
        // Translate every element by (-minX, -minY) so the group's top-left
        // sits at (0, 0). Drop callers can then offset by the drop point.
        for (const e of els) {
            translateElement(e, -minX, -minY);
        }

        return {
            id: item.id ?? `item-${idx}`,
            name: item.name ?? `Item ${idx + 1}`,
            elements: els,
            bounds: { x: 0, y: 0, width: maxX - minX, height: maxY - minY },
        };
    });

    return { name: fallbackName, items };
}

function convertElement(
    src: ExcalidrawElement,
):
    | Omit<Element, 'id' | 'pageId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'zIndex'>
    | null
{
    const opacity = (src.opacity ?? 100) / 100;
    const seed = src.seed ?? generateRoughSeed();
    const w = src.width ?? 100;
    const h = src.height ?? 100;
    const bounds = { x: src.x, y: src.y, width: w, height: h };

    if (src.type === 'rectangle' || src.type === 'diamond' || src.type === 'ellipse') {
        const data: ShapeElement['data'] = {
            shapeType: src.type,
            position: { x: src.x, y: src.y },
            size: { width: w, height: h },
            rotation: ((src.angle ?? 0) * 180) / Math.PI,
            style: {
                ...DEFAULT_SHAPE_STYLE,
                stroke: {
                    ...DEFAULT_STROKE_STYLE,
                    color: src.strokeColor ?? DEFAULT_STROKE_STYLE.color,
                    width: src.strokeWidth ?? DEFAULT_STROKE_STYLE.width,
                    opacity,
                    pattern: src.strokeStyle ?? 'solid',
                },
                fill: src.backgroundColor && src.backgroundColor !== 'transparent'
                    ? {
                        type: src.fillStyle ?? 'solid',
                        color: src.backgroundColor,
                        opacity,
                    }
                    : { type: 'none', color: '#000', opacity: 1 },
                roughness: src.roughness ?? 1,
                seed,
            },
            bounds,
        };
        return { type: 'shape', data };
    }

    if (src.type === 'arrow' || src.type === 'line') {
        const points = (src.points ?? [[0, 0], [w, h]]).map(([px, py]) => ({
            x: src.x + px,
            y: src.y + py,
        }));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        const data: LinearElement['data'] = {
            linearType: src.type,
            points,
            rotation: ((src.angle ?? 0) * 180) / Math.PI,
            style: {
                ...DEFAULT_STROKE_STYLE,
                color: src.strokeColor ?? DEFAULT_STROKE_STYLE.color,
                width: src.strokeWidth ?? DEFAULT_STROKE_STYLE.width,
                opacity,
                pattern: src.strokeStyle ?? 'solid',
            },
            roughness: src.roughness ?? 1,
            seed,
            arrowStart: false,
            arrowEnd: src.type === 'arrow',
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        };
        return { type: 'linear', data };
    }

    if (src.type === 'text') {
        const data: TextElement['data'] = {
            content: src.text ?? '',
            position: { x: src.x, y: src.y },
            size: { width: w, height: h },
            rotation: ((src.angle ?? 0) * 180) / Math.PI,
            style: {
                ...DEFAULT_TEXT_STYLE,
                fontSize: src.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
                color: src.strokeColor ?? DEFAULT_TEXT_STYLE.color,
                textAlign: src.textAlign ?? 'left',
                opacity,
            },
            bounds,
        };
        return { type: 'text', data };
    }

    if (src.type === 'freedraw' && src.points) {
        const points = src.points.map(([px, py]) => ({ x: src.x + px, y: src.y + py }));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        const data: StrokeElement['data'] = {
            points,
            pressures: src.pressures,
            style: {
                ...DEFAULT_STROKE_STYLE,
                color: src.strokeColor ?? DEFAULT_STROKE_STYLE.color,
                width: src.strokeWidth ?? DEFAULT_STROKE_STYLE.width,
                opacity,
            },
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        };
        return { type: 'stroke', data };
    }

    return null;
}

function translateElement(el: { type: string; data: any }, dx: number, dy: number) {
    if (el.data.position) el.data.position = { x: el.data.position.x + dx, y: el.data.position.y + dy };
    if (Array.isArray(el.data.points)) el.data.points = el.data.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
    if (el.data.bounds) el.data.bounds = { ...el.data.bounds, x: el.data.bounds.x + dx, y: el.data.bounds.y + dy };
}
