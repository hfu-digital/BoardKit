import { describe, it, expect } from 'vitest';
import {
    getShapeCenter,
    intersectShapePerimeter,
    distanceToShapePerimeter,
} from '../../src/geometry/perimeter';
import type { ShapeElement } from '../../src/types/elements';
import { DEFAULT_SHAPE_STYLE } from '../../src/constants';

function makeShape(
    shapeType: ShapeElement['data']['shapeType'],
    {
        x = 0,
        y = 0,
        width = 100,
        height = 60,
        rotation = 0,
    }: { x?: number; y?: number; width?: number; height?: number; rotation?: number } = {},
): ShapeElement {
    return {
        id: `shape-${shapeType}`,
        pageId: 'p1',
        type: 'shape',
        zIndex: 0,
        createdBy: 'u1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            shapeType,
            position: { x, y },
            size: { width, height },
            rotation,
            style: { ...DEFAULT_SHAPE_STYLE },
            bounds: { x, y, width, height },
        },
    };
}

const TOL = 1e-6;

describe('getShapeCenter', () => {
    it('returns the geometric center', () => {
        const c = getShapeCenter(makeShape('rectangle', { x: 10, y: 20, width: 40, height: 30 }));
        expect(c.x).toBeCloseTo(30, 6);
        expect(c.y).toBeCloseTo(35, 6);
    });
});

describe('intersectShapePerimeter — rectangle', () => {
    // 100 × 60 rectangle at origin: hw = 50, hh = 30, center (50, 30).
    const rect = makeShape('rectangle');

    it('hits the right edge for a point straight to the right', () => {
        const p = intersectShapePerimeter(rect, { x: 200, y: 30 });
        expect(p.x).toBeCloseTo(100, 6);
        expect(p.y).toBeCloseTo(30, 6);
    });

    it('hits the left edge for a point straight to the left', () => {
        const p = intersectShapePerimeter(rect, { x: -200, y: 30 });
        expect(p.x).toBeCloseTo(0, 6);
        expect(p.y).toBeCloseTo(30, 6);
    });

    it('hits the top edge for a point above center', () => {
        const p = intersectShapePerimeter(rect, { x: 50, y: -200 });
        expect(p.x).toBeCloseTo(50, 6);
        expect(p.y).toBeCloseTo(0, 6);
    });

    it('hits the bottom edge for a point below center', () => {
        const p = intersectShapePerimeter(rect, { x: 50, y: 200 });
        expect(p.x).toBeCloseTo(50, 6);
        expect(p.y).toBeCloseTo(60, 6);
    });

    it('returns a corner-ish point on a 45° external direction', () => {
        // Rect 100 wide × 60 tall: 45° from center exits the top edge first
        // because hh < hw.
        const p = intersectShapePerimeter(rect, { x: 200, y: -200 });
        expect(p.y).toBeCloseTo(0, 6);
        expect(p.x).toBeGreaterThan(50);
        expect(p.x).toBeLessThanOrEqual(100);
    });
});

describe('intersectShapePerimeter — diamond', () => {
    // Diamond inscribed in 100 × 60 bbox: vertices at (50,0), (100,30), (50,60), (0,30).
    const dia = makeShape('diamond');

    it('hits the top vertex for a point straight above center', () => {
        const p = intersectShapePerimeter(dia, { x: 50, y: -200 });
        expect(p.x).toBeCloseTo(50, 6);
        expect(p.y).toBeCloseTo(0, 6);
    });

    it('hits the right vertex for a point straight to the right', () => {
        const p = intersectShapePerimeter(dia, { x: 200, y: 30 });
        expect(p.x).toBeCloseTo(100, 6);
        expect(p.y).toBeCloseTo(30, 6);
    });

    it('lies on the |x|/hw + |y|/hh = 1 perimeter for a 45° external', () => {
        const p = intersectShapePerimeter(dia, { x: 200, y: 200 });
        const hw = 50;
        const hh = 30;
        const cx = 50;
        const cy = 30;
        const norm = Math.abs(p.x - cx) / hw + Math.abs(p.y - cy) / hh;
        expect(norm).toBeCloseTo(1, 6);
    });
});

describe('intersectShapePerimeter — ellipse', () => {
    // 100 × 60 ellipse: hw = 50, hh = 30, center (50, 30).
    const ell = makeShape('ellipse');

    it('hits the right at y = center for a point straight to the right', () => {
        const p = intersectShapePerimeter(ell, { x: 200, y: 30 });
        expect(p.x).toBeCloseTo(100, 6);
        expect(p.y).toBeCloseTo(30, 6);
    });

    it('hits the top at x = center for a point straight above', () => {
        const p = intersectShapePerimeter(ell, { x: 50, y: -200 });
        expect(p.x).toBeCloseTo(50, 6);
        expect(p.y).toBeCloseTo(0, 6);
    });

    it('lies on the ellipse for any external direction', () => {
        const externals = [
            { x: 200, y: 200 },
            { x: -300, y: 80 },
            { x: 90, y: -50 },
        ];
        for (const e of externals) {
            const p = intersectShapePerimeter(ell, e);
            const norm =
                ((p.x - 50) * (p.x - 50)) / (50 * 50) +
                ((p.y - 30) * (p.y - 30)) / (30 * 30);
            expect(norm).toBeCloseTo(1, 5);
        }
    });
});

describe('intersectShapePerimeter — rotation', () => {
    it('a 90°-rotated rectangle still hits its edge straight up', () => {
        // Rotation is around the shape center.
        const rect = makeShape('rectangle', {
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            rotation: 90,
        });
        // Straight above the center (50, 30): in the rotated rect, the top
        // edge in world space is the rotated counterpart of the right edge.
        // So the intersection y should be center.y - hw_world_along_y = 30 - 50 = -20.
        const p = intersectShapePerimeter(rect, { x: 50, y: -200 });
        expect(p.x).toBeCloseTo(50, 5);
        expect(p.y).toBeCloseTo(-20, 5);
    });
});

describe('distanceToShapePerimeter', () => {
    it('returns 0 for a point inside the rectangle', () => {
        const rect = makeShape('rectangle');
        expect(distanceToShapePerimeter(rect, { x: 50, y: 30 })).toBe(0);
        expect(distanceToShapePerimeter(rect, { x: 1, y: 1 })).toBe(0);
    });

    it('returns 0 for a point on the rectangle edge', () => {
        const rect = makeShape('rectangle');
        expect(distanceToShapePerimeter(rect, { x: 0, y: 30 })).toBe(0);
    });

    it('returns positive Euclidean distance outside the rectangle', () => {
        const rect = makeShape('rectangle');
        // 10 px to the right of x=100.
        expect(distanceToShapePerimeter(rect, { x: 110, y: 30 })).toBeCloseTo(10, 6);
    });

    it('returns 0 for a point inside the diamond', () => {
        const dia = makeShape('diamond');
        // Center is inside.
        expect(distanceToShapePerimeter(dia, { x: 50, y: 30 })).toBe(0);
    });

    it('returns positive distance for a point outside the diamond corner', () => {
        const dia = makeShape('diamond');
        const d = distanceToShapePerimeter(dia, { x: 110, y: 30 });
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(20);
    });

    it('returns 0 for a point inside the ellipse', () => {
        const ell = makeShape('ellipse');
        expect(distanceToShapePerimeter(ell, { x: 50, y: 30 })).toBe(0);
    });

    it('grows monotonically as you move away from a circle', () => {
        // Circle at (0, 0), w=100, h=100 → center (50, 50), radius 50.
        const circle = makeShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
        const inside = distanceToShapePerimeter(circle, { x: 60, y: 50 });
        const onPerim = distanceToShapePerimeter(circle, { x: 100, y: 50 });
        const fifty = distanceToShapePerimeter(circle, { x: 150, y: 50 });
        const farther = distanceToShapePerimeter(circle, { x: 200, y: 50 });
        expect(inside).toBe(0);
        expect(onPerim).toBe(0);
        expect(fifty).toBeCloseTo(50, 6);
        expect(farther).toBeCloseTo(100, 6);
        expect(farther).toBeGreaterThan(fifty);
    });
});
