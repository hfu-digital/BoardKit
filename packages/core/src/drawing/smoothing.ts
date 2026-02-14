import type { Point } from '../types/elements';

/**
 * Smooths a set of raw points using Catmull-Rom spline interpolation.
 * @param points - Raw input points
 * @param tension - Spline tension (0 = straight, 1 = tight curves). Default: 0.5
 * @param segments - Number of interpolated segments between each pair. Default: 8
 */
export function smoothPoints(
    points: Point[],
    tension = 0.5,
    segments = 8,
): Point[] {
    if (points.length < 3) return [...points];

    const result: Point[] = [points[0]];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(i - 1, 0)];
        const p1 = points[i];
        const p2 = points[Math.min(i + 1, points.length - 1)];
        const p3 = points[Math.min(i + 2, points.length - 1)];

        for (let t = 1; t <= segments; t++) {
            const s = t / segments;
            const s2 = s * s;
            const s3 = s2 * s;

            const x =
                0.5 *
                ((2 * p1.x) +
                    (-p0.x + p2.x) * s * tension +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 * tension +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3 * tension);

            const y =
                0.5 *
                ((2 * p1.y) +
                    (-p0.y + p2.y) * s * tension +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 * tension +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3 * tension);

            result.push({ x, y });
        }
    }

    return result;
}
