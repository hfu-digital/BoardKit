import type { Point, Rect } from '../types/elements';

export interface AlignmentGuide {
    type: 'vertical' | 'horizontal';
    position: number; // x for vertical, y for horizontal
    start: number;    // start of the guide line
    end: number;      // end of the guide line
}

/**
 * Find alignment guides for a moving element against all other elements.
 * Returns guides where edges or centers align within the threshold.
 */
export function findAlignmentGuides(
    movingBounds: Rect,
    otherElements: Rect[],
    threshold: number = 5,
): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];

    const movingEdges = {
        left: movingBounds.x,
        right: movingBounds.x + movingBounds.width,
        centerX: movingBounds.x + movingBounds.width / 2,
        top: movingBounds.y,
        bottom: movingBounds.y + movingBounds.height,
        centerY: movingBounds.y + movingBounds.height / 2,
    };

    for (const other of otherElements) {
        const otherEdges = {
            left: other.x,
            right: other.x + other.width,
            centerX: other.x + other.width / 2,
            top: other.y,
            bottom: other.y + other.height,
            centerY: other.y + other.height / 2,
        };

        // Vertical guides (x-axis alignment)
        const verticalPairs: [number, number][] = [
            [movingEdges.left, otherEdges.left],
            [movingEdges.left, otherEdges.right],
            [movingEdges.right, otherEdges.left],
            [movingEdges.right, otherEdges.right],
            [movingEdges.centerX, otherEdges.centerX],
            [movingEdges.left, otherEdges.centerX],
            [movingEdges.right, otherEdges.centerX],
            [movingEdges.centerX, otherEdges.left],
            [movingEdges.centerX, otherEdges.right],
        ];

        for (const [movingVal, otherVal] of verticalPairs) {
            if (Math.abs(movingVal - otherVal) <= threshold) {
                const minY = Math.min(movingBounds.y, other.y);
                const maxY = Math.max(
                    movingBounds.y + movingBounds.height,
                    other.y + other.height,
                );
                guides.push({
                    type: 'vertical',
                    position: otherVal,
                    start: minY,
                    end: maxY,
                });
            }
        }

        // Horizontal guides (y-axis alignment)
        const horizontalPairs: [number, number][] = [
            [movingEdges.top, otherEdges.top],
            [movingEdges.top, otherEdges.bottom],
            [movingEdges.bottom, otherEdges.top],
            [movingEdges.bottom, otherEdges.bottom],
            [movingEdges.centerY, otherEdges.centerY],
            [movingEdges.top, otherEdges.centerY],
            [movingEdges.bottom, otherEdges.centerY],
            [movingEdges.centerY, otherEdges.top],
            [movingEdges.centerY, otherEdges.bottom],
        ];

        for (const [movingVal, otherVal] of horizontalPairs) {
            if (Math.abs(movingVal - otherVal) <= threshold) {
                const minX = Math.min(movingBounds.x, other.x);
                const maxX = Math.max(
                    movingBounds.x + movingBounds.width,
                    other.x + other.width,
                );
                guides.push({
                    type: 'horizontal',
                    position: otherVal,
                    start: minX,
                    end: maxX,
                });
            }
        }
    }

    // Deduplicate guides that are very close to each other
    return deduplicateGuides(guides, threshold / 2);
}

function deduplicateGuides(guides: AlignmentGuide[], tolerance: number): AlignmentGuide[] {
    const result: AlignmentGuide[] = [];
    for (const guide of guides) {
        const exists = result.some(
            (g) => g.type === guide.type && Math.abs(g.position - guide.position) < tolerance,
        );
        if (!exists) result.push(guide);
    }
    return result;
}

/**
 * Snap a moving rect to the nearest alignment guide.
 * Returns the snapped position delta.
 */
export function snapToAlignment(
    movingBounds: Rect,
    otherElements: Rect[],
    threshold: number = 5,
): { dx: number; dy: number; guides: AlignmentGuide[] } {
    const guides = findAlignmentGuides(movingBounds, otherElements, threshold);
    let dx = 0;
    let dy = 0;

    // Find closest vertical guide
    let closestVert: AlignmentGuide | null = null;
    let closestVertDist = threshold + 1;
    for (const g of guides.filter((g) => g.type === 'vertical')) {
        const edgeDists = [
            Math.abs(movingBounds.x - g.position),
            Math.abs(movingBounds.x + movingBounds.width - g.position),
            Math.abs(movingBounds.x + movingBounds.width / 2 - g.position),
        ];
        const minDist = Math.min(...edgeDists);
        if (minDist < closestVertDist) {
            closestVertDist = minDist;
            closestVert = g;
            // Determine which edge is closest and compute dx
            if (edgeDists[0] === minDist) dx = g.position - movingBounds.x;
            else if (edgeDists[1] === minDist) dx = g.position - (movingBounds.x + movingBounds.width);
            else dx = g.position - (movingBounds.x + movingBounds.width / 2);
        }
    }

    // Find closest horizontal guide
    let closestHoriz: AlignmentGuide | null = null;
    let closestHorizDist = threshold + 1;
    for (const g of guides.filter((g) => g.type === 'horizontal')) {
        const edgeDists = [
            Math.abs(movingBounds.y - g.position),
            Math.abs(movingBounds.y + movingBounds.height - g.position),
            Math.abs(movingBounds.y + movingBounds.height / 2 - g.position),
        ];
        const minDist = Math.min(...edgeDists);
        if (minDist < closestHorizDist) {
            closestHorizDist = minDist;
            closestHoriz = g;
            if (edgeDists[0] === minDist) dy = g.position - movingBounds.y;
            else if (edgeDists[1] === minDist) dy = g.position - (movingBounds.y + movingBounds.height);
            else dy = g.position - (movingBounds.y + movingBounds.height / 2);
        }
    }

    const activeGuides: AlignmentGuide[] = [];
    if (closestVert) activeGuides.push(closestVert);
    if (closestHoriz) activeGuides.push(closestHoriz);

    return { dx, dy, guides: activeGuides };
}
