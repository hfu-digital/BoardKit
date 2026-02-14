import type { Point } from '../types/elements';

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        const ex = point.x - lineStart.x;
        const ey = point.y - lineStart.y;
        return Math.sqrt(ex * ex + ey * ey);
    }

    const t = Math.max(0, Math.min(1,
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
    ));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    const ex = point.x - projX;
    const ey = point.y - projY;
    return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
 * @param points - Input points
 * @param tolerance - Maximum distance from the simplified line. Default: 1.0
 */
export function simplifyPoints(points: Point[], tolerance = 1.0): Point[] {
    if (points.length <= 2) return [...points];

    let maxDist = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(
            points[i],
            points[0],
            points[points.length - 1],
        );
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    if (maxDist > tolerance) {
        const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
        const right = simplifyPoints(points.slice(maxIndex), tolerance);
        return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[points.length - 1]];
}
