import type { Point, Rect } from '../types/elements';

export interface GridConfig {
    enabled: boolean;
    size: number; // grid cell size in world units (default 20)
    snapEnabled: boolean;
    snapThreshold: number; // snap distance in px (default 5)
    visible: boolean;
}

export function createDefaultGridConfig(): GridConfig {
    return {
        enabled: false,
        size: 20,
        snapEnabled: false,
        snapThreshold: 5,
        visible: false,
    };
}

export function snapToGrid(point: Point, config: GridConfig): Point {
    if (!config.snapEnabled || !config.enabled) return point;
    return {
        x: Math.round(point.x / config.size) * config.size,
        y: Math.round(point.y / config.size) * config.size,
    };
}

export function snapRectToGrid(rect: Rect, config: GridConfig): Rect {
    if (!config.snapEnabled || !config.enabled) return rect;
    const snapped = snapToGrid({ x: rect.x, y: rect.y }, config);
    return { ...rect, x: snapped.x, y: snapped.y };
}
