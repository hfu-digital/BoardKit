import { describe, it, expect } from 'vitest';
import { smoothPoints } from '../../src/drawing/smoothing';
import { simplifyPoints } from '../../src/drawing/simplify';
import { pressureToWidth } from '../../src/drawing/pressure';

describe('smoothPoints', () => {
    it('returns copy for fewer than 3 points', () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
        const result = smoothPoints(points);
        expect(result).toEqual(points);
        expect(result).not.toBe(points);
    });

    it('produces more points than input for 3+ points', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
        ];
        const result = smoothPoints(points);
        expect(result.length).toBeGreaterThan(points.length);
    });

    it('starts with the first input point', () => {
        const points = [
            { x: 5, y: 5 },
            { x: 15, y: 15 },
            { x: 25, y: 5 },
        ];
        const result = smoothPoints(points);
        expect(result[0]).toEqual({ x: 5, y: 5 });
    });
});

describe('simplifyPoints', () => {
    it('returns copy for 2 or fewer points', () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
        const result = simplifyPoints(points);
        expect(result).toEqual(points);
        expect(result).not.toBe(points);
    });

    it('reduces collinear points', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
            { x: 15, y: 0 },
            { x: 20, y: 0 },
        ];
        const result = simplifyPoints(points, 1.0);
        expect(result.length).toBe(2);
        expect(result[0]).toEqual({ x: 0, y: 0 });
        expect(result[result.length - 1]).toEqual({ x: 20, y: 0 });
    });

    it('preserves points that deviate significantly', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 100 },
            { x: 10, y: 0 },
        ];
        const result = simplifyPoints(points, 1.0);
        expect(result.length).toBe(3);
    });
});

describe('pressureToWidth', () => {
    it('returns min width at pressure 0', () => {
        expect(pressureToWidth(0, 10)).toBeCloseTo(3); // 10 * 0.3
    });

    it('returns max width at pressure 1', () => {
        expect(pressureToWidth(1, 10)).toBeCloseTo(15); // 10 * 1.5
    });

    it('clamps pressure below 0', () => {
        expect(pressureToWidth(-1, 10)).toBeCloseTo(3);
    });

    it('clamps pressure above 1', () => {
        expect(pressureToWidth(2, 10)).toBeCloseTo(15);
    });

    it('interpolates linearly at midpoint', () => {
        expect(pressureToWidth(0.5, 10)).toBeCloseTo(9); // 10 * (0.3 + 0.5 * 1.2)
    });
});
