import type { Element, Point, Rect } from '../types/elements';
import { resolveLinearEndpoints } from '../operations/resolve-bindings';
import type { SceneState } from './scene-graph';

export function calculateBounds(element: Element): Rect {
    // All current element data shapes carry a precomputed `bounds` field —
    // tools are responsible for keeping it in sync with their geometry.
    return element.data.bounds;
}

export function boundsIntersect(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

export function boundsContain(outer: Rect, inner: Rect): boolean {
    return (
        outer.x <= inner.x &&
        outer.y <= inner.y &&
        outer.x + outer.width >= inner.x + inner.width &&
        outer.y + outer.height >= inner.y + inner.height
    );
}

export function pointInBounds(point: Point, bounds: Rect): boolean {
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

export function expandBounds(bounds: Rect, padding: number): Rect {
    return {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
    };
}

export function mergeBounds(bounds: Rect[]): Rect {
    if (bounds.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of bounds) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Shape-aware hit test. Differs from `pointInBounds` in two ways:
 *   1. Shapes with `fill.type === 'none'` only hit on the stroke — clicks in
 *      a transparent rectangle's interior fall through to whatever is behind.
 *      This matches Excalidraw and prevents large transparent shapes from
 *      "stealing" clicks from smaller elements visually inside them.
 *   2. Linear elements (line / arrow) hit on point-to-segment distance, not
 *      on the bounding box — otherwise long diagonal lines have a huge
 *      bounding box that captures clicks far from the actual stroke.
 *
 * `tolerance` is in world units. Pass `screenTolerancePx / viewport.zoom`
 * so the on-screen forgiveness stays roughly constant across zoom levels.
 *
 * `scene` is optional and only consulted for resolving bound endpoints on
 * linear elements; pass it from `SelectTool` so arrows attached to shapes
 * hit-test against their actual rendered geometry, not the cached `points`.
 */
export function hitTestElement(
    point: Point,
    element: Element,
    tolerance: number,
    scene?: SceneState,
): boolean {
    switch (element.type) {
        case 'text':
        case 'image':
        case 'stroke':
            return pointInBounds(point, calculateBounds(element));
        case 'group':
            // Groups don't render themselves; hits fall through to children.
            return false;
        case 'shape': {
            const filled = element.data.style.fill.type !== 'none';
            if (filled) return pointInBounds(point, calculateBounds(element));
            const strokeWidth = element.data.style.stroke.width;
            const t = Math.max(tolerance, strokeWidth / 2 + 2);
            return pointOnShapePerimeter(point, element, t);
        }
        case 'linear': {
            const points = scene
                ? resolveLinearEndpoints(element, scene)
                : element.data.points;
            const strokeWidth = element.data.style.width;
            const t = Math.max(tolerance, strokeWidth / 2 + 2);
            return pointOnPolyline(point, points, t);
        }
    }
}

function pointOnShapePerimeter(
    point: Point,
    element: Element & { type: 'shape' },
    tolerance: number,
): boolean {
    const { position, size, data } = { position: element.data.position, size: element.data.size, data: element.data };
    const x = position.x;
    const y = position.y;
    const w = size.width;
    const h = size.height;
    if (data.shapeType === 'rectangle') {
        return pointOnRectPerimeter(point, x, y, w, h, tolerance);
    }
    if (data.shapeType === 'ellipse') {
        return pointOnEllipsePerimeter(point, x, y, w, h, tolerance);
    }
    // diamond — four edges between midpoints of the bounding rect
    const cx = x + w / 2;
    const cy = y + h / 2;
    const top: Point = { x: cx, y };
    const right: Point = { x: x + w, y: cy };
    const bottom: Point = { x: cx, y: y + h };
    const left: Point = { x, y: cy };
    return (
        pointOnSegment(point, top, right, tolerance) ||
        pointOnSegment(point, right, bottom, tolerance) ||
        pointOnSegment(point, bottom, left, tolerance) ||
        pointOnSegment(point, left, top, tolerance)
    );
}

function pointOnRectPerimeter(
    point: Point,
    x: number,
    y: number,
    w: number,
    h: number,
    tolerance: number,
): boolean {
    // Inside the outer band but outside the inner hollow → on the stroke.
    const inside =
        point.x >= x - tolerance &&
        point.x <= x + w + tolerance &&
        point.y >= y - tolerance &&
        point.y <= y + h + tolerance;
    if (!inside) return false;
    const outsideInner =
        point.x < x + tolerance ||
        point.x > x + w - tolerance ||
        point.y < y + tolerance ||
        point.y > y + h - tolerance;
    return outsideInner;
}

function pointOnEllipsePerimeter(
    point: Point,
    x: number,
    y: number,
    w: number,
    h: number,
    tolerance: number,
): boolean {
    const rx = w / 2;
    const ry = h / 2;
    if (rx <= 0 || ry <= 0) return false;
    const cx = x + rx;
    const cy = y + ry;
    const dx = point.x - cx;
    const dy = point.y - cy;
    // Annulus check: between inner and outer ellipse expanded by tolerance.
    const outer = (dx * dx) / ((rx + tolerance) * (rx + tolerance)) + (dy * dy) / ((ry + tolerance) * (ry + tolerance));
    if (outer > 1) return false;
    const innerRx = Math.max(0, rx - tolerance);
    const innerRy = Math.max(0, ry - tolerance);
    if (innerRx === 0 || innerRy === 0) return true;
    const inner = (dx * dx) / (innerRx * innerRx) + (dy * dy) / (innerRy * innerRy);
    return inner >= 1;
}

function pointOnPolyline(point: Point, points: Point[], tolerance: number): boolean {
    for (let i = 0; i < points.length - 1; i++) {
        if (pointOnSegment(point, points[i], points[i + 1], tolerance)) return true;
    }
    return false;
}

function pointOnSegment(p: Point, a: Point, b: Point, tolerance: number): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        const ddx = p.x - a.x;
        const ddy = p.y - a.y;
        return ddx * ddx + ddy * ddy <= tolerance * tolerance;
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const ddx = p.x - projX;
    const ddy = p.y - projY;
    return ddx * ddx + ddy * ddy <= tolerance * tolerance;
}
