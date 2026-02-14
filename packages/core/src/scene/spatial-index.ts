import type { Element, Point, Rect } from '../types/elements';
import { calculateBounds } from './bounds';

const DEFAULT_CELL_SIZE = 200;

interface Cell {
    elementIds: Set<string>;
}

export interface SpatialIndex {
    cells: Map<string, Cell>;
    cellSize: number;
    elementBounds: Map<string, Rect>;
}

function cellKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
}

function getCellRange(rect: Rect, cellSize: number): { minCx: number; minCy: number; maxCx: number; maxCy: number } {
    return {
        minCx: Math.floor(rect.x / cellSize),
        minCy: Math.floor(rect.y / cellSize),
        maxCx: Math.floor((rect.x + rect.width) / cellSize),
        maxCy: Math.floor((rect.y + rect.height) / cellSize),
    };
}

export function createSpatialIndex(elements: Element[], cellSize = DEFAULT_CELL_SIZE): SpatialIndex {
    const cells = new Map<string, Cell>();
    const elementBounds = new Map<string, Rect>();

    for (const element of elements) {
        const bounds = calculateBounds(element);
        elementBounds.set(element.id, bounds);
        const range = getCellRange(bounds, cellSize);
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
            for (let cy = range.minCy; cy <= range.maxCy; cy++) {
                const key = cellKey(cx, cy);
                let cell = cells.get(key);
                if (!cell) {
                    cell = { elementIds: new Set() };
                    cells.set(key, cell);
                }
                cell.elementIds.add(element.id);
            }
        }
    }

    return { cells, cellSize, elementBounds };
}

export function queryRect(index: SpatialIndex, rect: Rect): string[] {
    const results = new Set<string>();
    const range = getCellRange(rect, index.cellSize);
    for (let cx = range.minCx; cx <= range.maxCx; cx++) {
        for (let cy = range.minCy; cy <= range.maxCy; cy++) {
            const cell = index.cells.get(cellKey(cx, cy));
            if (cell) {
                for (const id of cell.elementIds) {
                    results.add(id);
                }
            }
        }
    }
    return Array.from(results);
}

export function queryPoint(index: SpatialIndex, point: Point): string[] {
    const results: string[] = [];
    const cx = Math.floor(point.x / index.cellSize);
    const cy = Math.floor(point.y / index.cellSize);
    const cell = index.cells.get(cellKey(cx, cy));
    if (!cell) return results;

    for (const id of cell.elementIds) {
        const bounds = index.elementBounds.get(id);
        if (bounds &&
            point.x >= bounds.x &&
            point.x <= bounds.x + bounds.width &&
            point.y >= bounds.y &&
            point.y <= bounds.y + bounds.height
        ) {
            results.push(id);
        }
    }
    return results;
}

export function rebuild(index: SpatialIndex, elements: Element[]): SpatialIndex {
    return createSpatialIndex(elements, index.cellSize);
}
