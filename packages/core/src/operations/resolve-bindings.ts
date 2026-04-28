import type { LinearElement, Point, Rect, ShapeElement } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import {
    getShapeCenter,
    intersectShapePerimeter,
} from '../geometry/perimeter';

/**
 * Resolve a linear element's start and end points by applying any active
 * bindings. The single source of truth for "where does this line actually
 * draw?" — called by the renderer (defensively, so remote shape moves render
 * correctly even before our local follow-on lands) and by SelectTool when
 * propagating shape moves into bound arrows.
 *
 * When a shape is bound but no longer present in the scene (deletion, page
 * change), the binding is silently ignored and the stored `points[i]` is
 * used as-is. Same fallback applies when both endpoints are bound but the
 * shapes overlap so the center-to-center ray is degenerate.
 */
export function resolveLinearEndpoints(
    linear: LinearElement,
    scene: SceneState,
): [Point, Point] {
    const stored = linear.data.points;
    const storedStart = stored[0];
    const storedEnd = stored[stored.length - 1];

    const startShape = lookupBoundShape(linear.data.startBinding?.elementId, scene);
    const endShape = lookupBoundShape(linear.data.endBinding?.elementId, scene);

    if (!startShape && !endShape) {
        return [storedStart, storedEnd];
    }

    if (startShape && endShape) {
        // Both endpoints bound: shoot center-to-center, intersect each
        // perimeter with that line. Single-pass; matches Excalidraw and
        // stays stable for non-overlapping shapes.
        const startCenter = getShapeCenter(startShape);
        const endCenter = getShapeCenter(endShape);
        if (
            distance(startCenter, endCenter) < 1e-6 ||
            pointInShapeBounds(startCenter, endShape) ||
            pointInShapeBounds(endCenter, startShape)
        ) {
            // Degenerate / overlapping → fall back to stored points so we
            // never produce NaN or a flipped arrow.
            return [storedStart, storedEnd];
        }
        return [
            intersectShapePerimeter(startShape, endCenter),
            intersectShapePerimeter(endShape, startCenter),
        ];
    }

    if (startShape) {
        return [intersectShapePerimeter(startShape, storedEnd), storedEnd];
    }

    // endShape branch.
    return [storedStart, intersectShapePerimeter(endShape!, storedStart)];
}

/**
 * For a set of just-mutated shape ids, find every linear element in the
 * scene whose start or end binding references one of them. Returned in
 * scene order (no de-duplication needed since each element appears once
 * in `elementOrder`).
 */
export function getDependentLinears(
    scene: SceneState,
    movedIds: ReadonlySet<string>,
): LinearElement[] {
    const out: LinearElement[] = [];
    for (const id of scene.elementOrder) {
        const el = scene.elements.get(id);
        if (!el || el.type !== 'linear') continue;
        const data = el.data;
        const sb = data.startBinding?.elementId;
        const eb = data.endBinding?.elementId;
        if ((sb && movedIds.has(sb)) || (eb && movedIds.has(eb))) {
            out.push(el);
        }
    }
    return out;
}

/**
 * Apply `resolveLinearEndpoints` to produce a fresh LinearElement with
 * updated `points[]` and `bounds`. Other fields (style, seed, bindings,
 * arrowheads, …) are preserved verbatim.
 */
export function recomputeBoundLinear(
    linear: LinearElement,
    scene: SceneState,
): LinearElement {
    const [start, end] = resolveLinearEndpoints(linear, scene);
    const newPoints = [...linear.data.points];
    newPoints[0] = start;
    newPoints[newPoints.length - 1] = end;
    return {
        ...linear,
        data: {
            ...linear.data,
            points: newPoints,
            bounds: boundsFromPoints(newPoints),
        },
        updatedAt: new Date().toISOString(),
    };
}

function lookupBoundShape(
    id: string | undefined,
    scene: SceneState,
): ShapeElement | null {
    if (!id) return null;
    const el = scene.elements.get(id);
    if (!el || el.type !== 'shape') return null;
    return el;
}

function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointInShapeBounds(p: Point, shape: ShapeElement): boolean {
    const b = shape.data.bounds;
    return (
        p.x >= b.x &&
        p.x <= b.x + b.width &&
        p.y >= b.y &&
        p.y <= b.y + b.height
    );
}

function boundsFromPoints(points: Point[]): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
