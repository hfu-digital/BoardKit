import { describe, it, expect } from 'vitest';
import {
    boundsIntersect,
    boundsContain,
    pointInBounds,
    expandBounds,
    mergeBounds,
} from '../../src/scene/bounds';

describe('bounds', () => {
    describe('boundsIntersect', () => {
        it('returns true for overlapping rects', () => {
            expect(boundsIntersect(
                { x: 0, y: 0, width: 10, height: 10 },
                { x: 5, y: 5, width: 10, height: 10 },
            )).toBe(true);
        });

        it('returns false for non-overlapping rects', () => {
            expect(boundsIntersect(
                { x: 0, y: 0, width: 10, height: 10 },
                { x: 20, y: 20, width: 10, height: 10 },
            )).toBe(false);
        });

        it('returns false for adjacent (touching) rects', () => {
            expect(boundsIntersect(
                { x: 0, y: 0, width: 10, height: 10 },
                { x: 10, y: 0, width: 10, height: 10 },
            )).toBe(false);
        });
    });

    describe('boundsContain', () => {
        it('returns true when outer fully contains inner', () => {
            expect(boundsContain(
                { x: 0, y: 0, width: 100, height: 100 },
                { x: 10, y: 10, width: 20, height: 20 },
            )).toBe(true);
        });

        it('returns false when inner exceeds outer', () => {
            expect(boundsContain(
                { x: 10, y: 10, width: 20, height: 20 },
                { x: 0, y: 0, width: 100, height: 100 },
            )).toBe(false);
        });

        it('returns true when inner matches outer exactly', () => {
            const r = { x: 0, y: 0, width: 10, height: 10 };
            expect(boundsContain(r, r)).toBe(true);
        });
    });

    describe('pointInBounds', () => {
        it('returns true for a point inside bounds', () => {
            expect(pointInBounds({ x: 5, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
        });

        it('returns true for a point on the boundary', () => {
            expect(pointInBounds({ x: 0, y: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
            expect(pointInBounds({ x: 10, y: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
        });

        it('returns false for a point outside bounds', () => {
            expect(pointInBounds({ x: 15, y: 15 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
        });
    });

    describe('expandBounds', () => {
        it('expands bounds by padding on all sides', () => {
            const result = expandBounds({ x: 10, y: 10, width: 20, height: 20 }, 5);
            expect(result).toEqual({ x: 5, y: 5, width: 30, height: 30 });
        });
    });

    describe('mergeBounds', () => {
        it('returns zero rect for empty array', () => {
            expect(mergeBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
        });

        it('merges multiple rects into their bounding box', () => {
            const result = mergeBounds([
                { x: 0, y: 0, width: 10, height: 10 },
                { x: 20, y: 20, width: 10, height: 10 },
            ]);
            expect(result).toEqual({ x: 0, y: 0, width: 30, height: 30 });
        });

        it('returns the same rect for a single input', () => {
            const rect = { x: 5, y: 5, width: 15, height: 15 };
            expect(mergeBounds([rect])).toEqual(rect);
        });
    });
});
