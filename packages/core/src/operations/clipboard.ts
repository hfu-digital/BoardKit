import type { Element, Point } from '../types/elements';

let clipIdCounter = 0;
function generateClipId(): string {
    return `clip-${++clipIdCounter}-${Date.now()}`;
}

export function serializeSelection(elements: Element[]): string {
    if (elements.length === 0) return JSON.stringify({ elements: [] });

    // Calculate centroid to store relative positions
    let cx = 0;
    let cy = 0;
    let count = 0;
    for (const el of elements) {
        if ('bounds' in el.data) {
            const bounds = el.data.bounds;
            cx += bounds.x + bounds.width / 2;
            cy += bounds.y + bounds.height / 2;
            count++;
        }
    }
    if (count > 0) {
        cx /= count;
        cy /= count;
    }

    return JSON.stringify({ elements, centroid: { x: cx, y: cy } });
}

export function deserializeSelection(
    data: string,
    pastePosition: Point,
): Element[] {
    const parsed = JSON.parse(data);
    if (!parsed.elements || !Array.isArray(parsed.elements)) return [];

    const centroid: Point = parsed.centroid ?? { x: 0, y: 0 };
    const dx = pastePosition.x - centroid.x;
    const dy = pastePosition.y - centroid.y;

    return parsed.elements.map((el: Element) => {
        const newId = generateClipId();
        const now = new Date().toISOString();
        const newEl = {
            ...el,
            id: newId,
            createdAt: now,
            updatedAt: now,
        };

        // Offset position-based data
        if (newEl.data && 'bounds' in newEl.data) {
            newEl.data = {
                ...newEl.data,
                bounds: {
                    ...newEl.data.bounds,
                    x: newEl.data.bounds.x + dx,
                    y: newEl.data.bounds.y + dy,
                },
            };
        }
        if (newEl.data && 'position' in newEl.data) {
            const d = newEl.data as Record<string, unknown>;
            const pos = d.position as Point;
            newEl.data = {
                ...newEl.data,
                position: { x: pos.x + dx, y: pos.y + dy },
            };
        }
        if (newEl.data && 'points' in newEl.data) {
            const d = newEl.data as Record<string, unknown>;
            const points = d.points as Point[];
            newEl.data = {
                ...newEl.data,
                points: points.map((p) => ({
                    x: p.x + dx,
                    y: p.y + dy,
                })),
            };
        }

        return newEl;
    });
}
