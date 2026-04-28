import type { Point, Rect } from '../types/elements';

/**
 * 8 selection-handle positions: 4 corners (nw/ne/se/sw) and 4 edge
 * midpoints (n/e/s/w). Used both for hit-testing in `SelectTool` and for
 * rendering chrome in `interactive-layer` — same source of truth so the
 * visual handle is always exactly where the click lands.
 */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_PIXEL_SIZE = 8;

/**
 * World-space rects for all 8 handles around `bounds`. Handle pixel size is
 * fixed in screen space, so the world-space size is divided by zoom — that
 * way clicking the visible handle hits the right rect regardless of zoom.
 */
export function getSelectionHandleRects(
    bounds: Rect,
    zoom: number,
): Record<HandleId, Rect> {
    const size = HANDLE_PIXEL_SIZE / Math.max(zoom, 0.0001);
    const half = size / 2;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const r = bounds.x + bounds.width;
    const b = bounds.y + bounds.height;
    const make = (x: number, y: number): Rect => ({
        x: x - half,
        y: y - half,
        width: size,
        height: size,
    });
    return {
        nw: make(bounds.x, bounds.y),
        n: make(cx, bounds.y),
        ne: make(r, bounds.y),
        e: make(r, cy),
        se: make(r, b),
        s: make(cx, b),
        sw: make(bounds.x, b),
        w: make(bounds.x, cy),
    };
}

/**
 * The fixed origin during a handle drag — opposite corner / edge midpoint.
 * Currently unused by `applyHandleResize` (which derives positions from the
 * handle and the live pointer), but exposed in case a consumer wants to
 * draw the anchor or implement an alternative resize math.
 */
export function getHandleAnchor(handle: HandleId, bounds: Rect): Point {
    const r = bounds.x + bounds.width;
    const b = bounds.y + bounds.height;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    switch (handle) {
        case 'nw':
            return { x: r, y: b };
        case 'n':
            return { x: cx, y: b };
        case 'ne':
            return { x: bounds.x, y: b };
        case 'e':
            return { x: bounds.x, y: cy };
        case 'se':
            return { x: bounds.x, y: bounds.y };
        case 's':
            return { x: cx, y: bounds.y };
        case 'sw':
            return { x: r, y: bounds.y };
        case 'w':
            return { x: r, y: cy };
    }
}

/**
 * Compute new bounds from a handle drag.
 *
 * Modifiers:
 *  - shift: lock aspect ratio (axis with larger relative delta drives).
 *  - alt:   scale about the original center (mirror the moving side).
 */
export function applyHandleResize(
    handle: HandleId,
    originalBounds: Rect,
    pointerWorld: Point,
    modifiers: { shift: boolean; alt: boolean },
): Rect {
    let x = originalBounds.x;
    let y = originalBounds.y;
    let r = originalBounds.x + originalBounds.width;
    let b = originalBounds.y + originalBounds.height;

    if (handle === 'nw' || handle === 'w' || handle === 'sw') x = pointerWorld.x;
    if (handle === 'ne' || handle === 'e' || handle === 'se') r = pointerWorld.x;
    if (handle === 'nw' || handle === 'n' || handle === 'ne') y = pointerWorld.y;
    if (handle === 'sw' || handle === 's' || handle === 'se') b = pointerWorld.y;

    if (modifiers.shift && originalBounds.width > 0 && originalBounds.height > 0) {
        const aspect = originalBounds.width / originalBounds.height;
        const w = r - x;
        const h = b - y;
        if (Math.abs(w) / aspect > Math.abs(h)) {
            const newH = (Math.abs(w) / aspect) * Math.sign(h || 1);
            if (handle.includes('n')) y = b - newH;
            else b = y + newH;
        } else {
            const newW = Math.abs(h) * aspect * Math.sign(w || 1);
            if (handle.includes('w')) x = r - newW;
            else r = x + newW;
        }
    }

    if (modifiers.alt) {
        const cx = originalBounds.x + originalBounds.width / 2;
        const cy = originalBounds.y + originalBounds.height / 2;
        if (handle === 'nw' || handle === 'w' || handle === 'sw') r = 2 * cx - x;
        if (handle === 'ne' || handle === 'e' || handle === 'se') x = 2 * cx - r;
        if (handle === 'nw' || handle === 'n' || handle === 'ne') b = 2 * cy - y;
        if (handle === 'sw' || handle === 's' || handle === 'se') y = 2 * cy - b;
    }

    const minX = Math.min(x, r);
    const minY = Math.min(y, b);
    return {
        x: minX,
        y: minY,
        width: Math.abs(r - x),
        height: Math.abs(b - y),
    };
}

/** CSS cursor name for a handle. Maps to standard browser resize cursors. */
export function handleCursor(handle: HandleId): string {
    switch (handle) {
        case 'nw':
        case 'se':
            return 'nwse-resize';
        case 'ne':
        case 'sw':
            return 'nesw-resize';
        case 'n':
        case 's':
            return 'ns-resize';
        case 'e':
        case 'w':
            return 'ew-resize';
    }
}
