import type { Point } from '@hfu.digital/boardkit-core';

export interface ViewportState {
    offset: Point;
    zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

export function nearestZoomStep(zoom: number): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
        const d = Math.abs(ZOOM_STEPS[i] - zoom);
        if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

export function steppedZoom(zoom: number, dir: -1 | 1): number {
    const idx = nearestZoomStep(zoom);
    return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir))];
}

export function createViewport(): ViewportState {
    return { offset: { x: 0, y: 0 }, zoom: 1.0 };
}

export function screenToWorld(point: Point, viewport: ViewportState): Point {
    return {
        x: (point.x - viewport.offset.x) / viewport.zoom,
        y: (point.y - viewport.offset.y) / viewport.zoom,
    };
}

export function worldToScreen(point: Point, viewport: ViewportState): Point {
    return {
        x: point.x * viewport.zoom + viewport.offset.x,
        y: point.y * viewport.zoom + viewport.offset.y,
    };
}

export function applyViewportTransform(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportState,
): void {
    ctx.setTransform(
        viewport.zoom,
        0,
        0,
        viewport.zoom,
        viewport.offset.x,
        viewport.offset.y,
    );
}

export function zoomToPoint(
    viewport: ViewportState,
    point: Point,
    zoomDelta: number,
): ViewportState {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * (1 + zoomDelta)));
    const scale = newZoom / viewport.zoom;
    return {
        zoom: newZoom,
        offset: {
            x: point.x - (point.x - viewport.offset.x) * scale,
            y: point.y - (point.y - viewport.offset.y) * scale,
        },
    };
}
