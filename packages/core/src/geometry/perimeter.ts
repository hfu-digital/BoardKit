import type { Point, ShapeElement } from '../types/elements';

/**
 * Pure geometry helpers for shape perimeters. Used by linear-element binding
 * to compute where an arrow endpoint should attach when bound to a shape.
 *
 * All public functions operate in **world space**. Internally, when a shape
 * has non-zero `rotation`, the input point is inverse-rotated into shape-
 * local axis-aligned space, the math is done there, and the result is
 * rotated back so the caller never has to think about orientation.
 *
 * Diamond geometry note: the diamond shape in BoardKit is the axis-aligned
 * rhombus inscribed in the bbox (vertices at edge midpoints) — NOT a 45°-
 * rotated rectangle. See `shape.renderer.ts` `drawShapePath` for the
 * authoritative path.
 */

const EPSILON = 1e-9;

export function getShapeCenter(shape: ShapeElement): Point {
    return {
        x: shape.data.position.x + shape.data.size.width / 2,
        y: shape.data.position.y + shape.data.size.height / 2,
    };
}

function rotateAround(p: Point, center: Point, angleDeg: number): Point {
    if (angleDeg === 0) return p;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

/**
 * Where does a ray from the shape's center toward `externalPoint` cross the
 * shape's perimeter? If `externalPoint` coincides with the center we have no
 * direction, so we fall back to a point on the right edge.
 */
export function intersectShapePerimeter(
    shape: ShapeElement,
    externalPoint: Point,
): Point {
    const center = getShapeCenter(shape);
    const rotation = shape.data.rotation || 0;

    // Work in shape-local axis-aligned space.
    const localPoint = rotateAround(externalPoint, center, -rotation);
    const dx = localPoint.x - center.x;
    const dy = localPoint.y - center.y;

    if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        // Degenerate: external is the center. Pick the right edge midpoint
        // in local space — arbitrary but stable.
        const fallback = {
            x: center.x + shape.data.size.width / 2,
            y: center.y,
        };
        return rotateAround(fallback, center, rotation);
    }

    const hw = shape.data.size.width / 2;
    const hh = shape.data.size.height / 2;

    let local: Point;
    switch (shape.data.shapeType) {
        case 'rectangle':
            local = rectangleIntersection(center, dx, dy, hw, hh);
            break;
        case 'diamond':
            local = diamondIntersection(center, dx, dy, hw, hh);
            break;
        case 'ellipse':
            local = ellipseIntersection(center, dx, dy, hw, hh);
            break;
    }

    return rotateAround(local, center, rotation);
}

function rectangleIntersection(
    center: Point,
    dx: number,
    dy: number,
    hw: number,
    hh: number,
): Point {
    // Smallest positive t where center + t*(dx,dy) hits a wall.
    // For a degenerate axis (dx=0 or dy=0), the corresponding t is +Infinity
    // and is naturally ignored by Math.min.
    const tx = Math.abs(dx) < EPSILON ? Infinity : hw / Math.abs(dx);
    const ty = Math.abs(dy) < EPSILON ? Infinity : hh / Math.abs(dy);
    const t = Math.min(tx, ty);
    return { x: center.x + t * dx, y: center.y + t * dy };
}

function diamondIntersection(
    center: Point,
    dx: number,
    dy: number,
    hw: number,
    hh: number,
): Point {
    // Diamond perimeter: |dx_local|/hw + |dy_local|/hh = 1
    // Along the ray (t*dx, t*dy): t * (|dx|/hw + |dy|/hh) = 1
    const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
    if (denom < EPSILON) {
        return { x: center.x, y: center.y };
    }
    const t = 1 / denom;
    return { x: center.x + t * dx, y: center.y + t * dy };
}

function ellipseIntersection(
    center: Point,
    dx: number,
    dy: number,
    hw: number,
    hh: number,
): Point {
    // Ellipse: (x-cx)²/hw² + (y-cy)²/hh² = 1
    // Substituting (t*dx, t*dy): t² * (dx²/hw² + dy²/hh²) = 1
    const denomSq = (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh);
    if (denomSq < EPSILON) {
        return { x: center.x, y: center.y };
    }
    const t = 1 / Math.sqrt(denomSq);
    return { x: center.x + t * dx, y: center.y + t * dy };
}

/**
 * Heuristic distance from `point` to the shape's perimeter. Returns `0` when
 * the point is inside or on the perimeter. Used for hover-proximity checks
 * during arrow drag — does not need to be a true Euclidean closest-point
 * distance, just monotonic in that quantity over the proximity window.
 */
export function distanceToShapePerimeter(
    shape: ShapeElement,
    point: Point,
): number {
    const center = getShapeCenter(shape);
    const rotation = shape.data.rotation || 0;
    const local = rotateAround(point, center, -rotation);
    const dx = local.x - center.x;
    const dy = local.y - center.y;
    const hw = shape.data.size.width / 2;
    const hh = shape.data.size.height / 2;

    switch (shape.data.shapeType) {
        case 'rectangle':
            return distanceToRectangle(dx, dy, hw, hh);
        case 'diamond':
            return distanceToDiamond(dx, dy, hw, hh);
        case 'ellipse':
            return distanceToEllipse(dx, dy, hw, hh);
    }
}

function distanceToRectangle(dx: number, dy: number, hw: number, hh: number): number {
    // Inside (or on edge) → 0.
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return 0;
    // Outside: distance to nearest edge of the AABB. Clamp into the box,
    // then Euclidean to the original point.
    const cx = Math.max(-hw, Math.min(hw, dx));
    const cy = Math.max(-hh, Math.min(hh, dy));
    return Math.hypot(dx - cx, dy - cy);
}

function distanceToDiamond(dx: number, dy: number, hw: number, hh: number): number {
    // Inside iff |dx|/hw + |dy|/hh ≤ 1.
    if (Math.abs(dx) / hw + Math.abs(dy) / hh <= 1) return 0;
    // Outside: take the minimum point-to-segment distance over the four
    // diamond edges. Diamond vertices (in shape-local space, relative to
    // center): top (0,-hh), right (hw,0), bottom (0,hh), left (-hw,0).
    const verts: Point[] = [
        { x: 0, y: -hh },
        { x: hw, y: 0 },
        { x: 0, y: hh },
        { x: -hw, y: 0 },
    ];
    const p: Point = { x: dx, y: dy };
    let min = Infinity;
    for (let i = 0; i < 4; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % 4];
        const d = pointToSegmentDistance(p, a, b);
        if (d < min) min = d;
    }
    return min;
}

function distanceToEllipse(dx: number, dy: number, hw: number, hh: number): number {
    // Inside (including on perimeter) iff (dx/hw)² + (dy/hh)² ≤ 1.
    const norm = Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    if (norm <= 1) return 0;
    // Approximate by scaling the input point onto the perimeter along its
    // radial direction (intersection point along the ray from center) and
    // returning Euclidean distance to that. Good enough for the 12 px
    // proximity window we use; the approximation is exact for circles
    // (hw === hh) and within a few percent for moderately elongated
    // ellipses.
    const t = 1 / norm;
    return Math.hypot(dx - t * dx, dy - t * dy);
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq < EPSILON) {
        return Math.hypot(apx, apy);
    }
    let t = (apx * abx + apy * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = a.x + t * abx;
    const closestY = a.y + t * aby;
    return Math.hypot(p.x - closestX, p.y - closestY);
}
