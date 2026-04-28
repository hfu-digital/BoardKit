import { describe, it, expect } from 'vitest';
import {
    resolveLinearEndpoints,
    getDependentLinears,
    recomputeBoundLinear,
} from '../../src/operations/resolve-bindings';
import { loadElements } from '../../src/scene/scene-graph';
import type { LinearElement, ShapeElement } from '../../src/types/elements';
import { DEFAULT_SHAPE_STYLE, DEFAULT_STROKE_STYLE } from '../../src/constants';

function makeShape(
    id: string,
    {
        x = 0,
        y = 0,
        width = 100,
        height = 60,
        shapeType = 'rectangle' as ShapeElement['data']['shapeType'],
    }: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        shapeType?: ShapeElement['data']['shapeType'];
    } = {},
): ShapeElement {
    return {
        id,
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
            rotation: 0,
            style: { ...DEFAULT_SHAPE_STYLE },
            bounds: { x, y, width, height },
        },
    };
}

function makeLinear(
    id: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
    bindings: {
        startBinding?: { elementId: string };
        endBinding?: { elementId: string };
    } = {},
): LinearElement {
    return {
        id,
        pageId: 'p1',
        type: 'linear',
        zIndex: 1,
        createdBy: 'u1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            linearType: 'arrow',
            points: [start, end],
            rotation: 0,
            style: { ...DEFAULT_STROKE_STYLE },
            roughness: 0,
            seed: 1,
            arrowStart: false,
            arrowEnd: true,
            bounds: {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(end.x - start.x),
                height: Math.abs(end.y - start.y),
            },
            ...bindings,
        },
    };
}

describe('resolveLinearEndpoints', () => {
    it('returns stored points unchanged when neither endpoint is bound', () => {
        const scene = loadElements([makeShape('s1', { x: 0, y: 0 })]);
        const linear = makeLinear('l1', { x: 200, y: 200 }, { x: 300, y: 300 });
        const [start, end] = resolveLinearEndpoints(linear, scene);
        expect(start).toEqual({ x: 200, y: 200 });
        expect(end).toEqual({ x: 300, y: 300 });
    });

    it('snaps the start to the bound shape\'s perimeter facing the end', () => {
        const shape = makeShape('s1', { x: 0, y: 0, width: 100, height: 60 });
        const scene = loadElements([shape]);
        const linear = makeLinear(
            'l1',
            { x: 50, y: 30 }, // arbitrary stored — should be replaced
            { x: 300, y: 30 },
            { startBinding: { elementId: 's1' } },
        );
        const [start, end] = resolveLinearEndpoints(linear, scene);
        // Right edge midpoint, since end is straight to the right.
        expect(start.x).toBeCloseTo(100, 6);
        expect(start.y).toBeCloseTo(30, 6);
        expect(end).toEqual({ x: 300, y: 30 });
    });

    it('snaps the end to the bound shape\'s perimeter facing the start', () => {
        const shape = makeShape('s2', { x: 200, y: 0, width: 100, height: 60 });
        const scene = loadElements([shape]);
        const linear = makeLinear(
            'l1',
            { x: 50, y: 30 },
            { x: 250, y: 30 },
            { endBinding: { elementId: 's2' } },
        );
        const [start, end] = resolveLinearEndpoints(linear, scene);
        expect(start).toEqual({ x: 50, y: 30 });
        // Left edge of right shape — since start is to the left of it.
        expect(end.x).toBeCloseTo(200, 6);
        expect(end.y).toBeCloseTo(30, 6);
    });

    it('snaps both endpoints when both bindings are set', () => {
        const a = makeShape('A', { x: 0, y: 0, width: 100, height: 60 });
        const b = makeShape('B', { x: 300, y: 0, width: 100, height: 60 });
        const scene = loadElements([a, b]);
        const linear = makeLinear(
            'l1',
            { x: 50, y: 30 },
            { x: 350, y: 30 },
            {
                startBinding: { elementId: 'A' },
                endBinding: { elementId: 'B' },
            },
        );
        const [start, end] = resolveLinearEndpoints(linear, scene);
        // A's right edge, B's left edge — at center y because centers align.
        expect(start.x).toBeCloseTo(100, 6);
        expect(start.y).toBeCloseTo(30, 6);
        expect(end.x).toBeCloseTo(300, 6);
        expect(end.y).toBeCloseTo(30, 6);
    });

    it('falls back to stored points if a bound shape no longer exists', () => {
        const scene = loadElements([]);
        const linear = makeLinear(
            'l1',
            { x: 200, y: 200 },
            { x: 300, y: 300 },
            { startBinding: { elementId: 'gone' } },
        );
        const [start, end] = resolveLinearEndpoints(linear, scene);
        expect(start).toEqual({ x: 200, y: 200 });
        expect(end).toEqual({ x: 300, y: 300 });
    });

    it('falls back when both bound shapes overlap', () => {
        const a = makeShape('A', { x: 0, y: 0, width: 100, height: 60 });
        const b = makeShape('B', { x: 0, y: 0, width: 100, height: 60 });
        const scene = loadElements([a, b]);
        const linear = makeLinear(
            'l1',
            { x: 10, y: 10 },
            { x: 20, y: 20 },
            {
                startBinding: { elementId: 'A' },
                endBinding: { elementId: 'B' },
            },
        );
        const [start, end] = resolveLinearEndpoints(linear, scene);
        expect(start).toEqual({ x: 10, y: 10 });
        expect(end).toEqual({ x: 20, y: 20 });
    });
});

describe('getDependentLinears', () => {
    it('finds linears with start or end binding to any moved id', () => {
        const a = makeShape('A');
        const b = makeShape('B', { x: 200 });
        const c = makeShape('C', { x: 400 });
        const l1 = makeLinear('l1', { x: 0, y: 0 }, { x: 100, y: 100 }, {
            startBinding: { elementId: 'A' },
        });
        const l2 = makeLinear('l2', { x: 0, y: 0 }, { x: 100, y: 100 }, {
            endBinding: { elementId: 'B' },
        });
        const l3 = makeLinear('l3', { x: 0, y: 0 }, { x: 100, y: 100 }); // no bindings
        const l4 = makeLinear('l4', { x: 0, y: 0 }, { x: 100, y: 100 }, {
            startBinding: { elementId: 'C' },
        });
        const scene = loadElements([a, b, c, l1, l2, l3, l4]);
        const result = getDependentLinears(scene, new Set(['A', 'B']));
        expect(result.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
    });
});

describe('recomputeBoundLinear', () => {
    it('updates points, bounds, and updatedAt', () => {
        const shape = makeShape('s1', { x: 0, y: 0, width: 100, height: 60 });
        const scene = loadElements([shape]);
        const linear = makeLinear(
            'l1',
            { x: 50, y: 30 },
            { x: 300, y: 30 },
            { startBinding: { elementId: 's1' } },
        );
        const recomputed = recomputeBoundLinear(linear, scene);
        expect(recomputed.data.points[0].x).toBeCloseTo(100, 6);
        expect(recomputed.data.points[1]).toEqual({ x: 300, y: 30 });
        expect(recomputed.data.bounds.x).toBeCloseTo(100, 6);
        expect(recomputed.data.bounds.width).toBeCloseTo(200, 6);
        expect(recomputed.updatedAt).not.toBe(linear.updatedAt);
    });

    it('preserves seed, style, arrowEnd, and bindings', () => {
        const shape = makeShape('s1', { x: 0, y: 0, width: 100, height: 60 });
        const scene = loadElements([shape]);
        const linear = makeLinear(
            'l1',
            { x: 50, y: 30 },
            { x: 300, y: 30 },
            { startBinding: { elementId: 's1' } },
        );
        linear.data.seed = 12345;
        const recomputed = recomputeBoundLinear(linear, scene);
        expect(recomputed.data.seed).toBe(12345);
        expect(recomputed.data.startBinding).toEqual({ elementId: 's1' });
        expect(recomputed.data.arrowEnd).toBe(true);
    });
});
