import type { Element, Point, Rect } from '../types/elements';

export function moveElements(elements: Element[], delta: Point): Element[] {
    return elements.map((el) => {
        const now = new Date().toISOString();
        const newData = { ...el.data } as Record<string, unknown>;

        // Move bounds
        if ('bounds' in newData) {
            const bounds = newData.bounds as Rect;
            newData.bounds = {
                ...bounds,
                x: bounds.x + delta.x,
                y: bounds.y + delta.y,
            };
        }

        // Move position if present
        if ('position' in newData) {
            const pos = newData.position as Point;
            newData.position = {
                x: pos.x + delta.x,
                y: pos.y + delta.y,
            };
        }

        // Move points if present (strokes)
        if ('points' in newData && Array.isArray(newData.points)) {
            newData.points = (newData.points as Point[]).map((p) => ({
                x: p.x + delta.x,
                y: p.y + delta.y,
            }));
        }

        return { ...el, data: newData, updatedAt: now } as Element;
    });
}

export function resizeElement(element: Element, newBounds: Rect): Element {
    const now = new Date().toISOString();
    const newData = { ...element.data } as Record<string, unknown>;

    const oldBounds = newData.bounds as Rect | undefined;
    newData.bounds = { ...newBounds };

    // Update size if present
    if ('size' in newData) {
        newData.size = {
            width: newBounds.width,
            height: newBounds.height,
        };
    }

    // Update position if present
    if ('position' in newData) {
        newData.position = { x: newBounds.x, y: newBounds.y };
    }

    // Scale points if present (strokes)
    if ('points' in newData && Array.isArray(newData.points) && oldBounds) {
        const scaleX =
            oldBounds.width !== 0 ? newBounds.width / oldBounds.width : 1;
        const scaleY =
            oldBounds.height !== 0
                ? newBounds.height / oldBounds.height
                : 1;
        newData.points = (newData.points as Point[]).map((p) => ({
            x: newBounds.x + (p.x - oldBounds.x) * scaleX,
            y: newBounds.y + (p.y - oldBounds.y) * scaleY,
        }));
    }

    // Scale text fontSize so resize handles actually visibly change the text,
    // not just the bounding box. Use the smaller axis ratio to avoid
    // distortion (text is height-driven; using min(scaleX, scaleY) keeps
    // proportional scaling without overshooting on width-only drags).
    if (
        element.type === 'text' &&
        oldBounds &&
        oldBounds.width > 0 &&
        oldBounds.height > 0
    ) {
        const scaleX = newBounds.width / oldBounds.width;
        const scaleY = newBounds.height / oldBounds.height;
        const scale = Math.min(scaleX, scaleY);
        const style = newData.style as Record<string, unknown> | undefined;
        if (style && typeof style.fontSize === 'number') {
            newData.style = { ...style, fontSize: style.fontSize * scale };
        }
    }

    return { ...element, data: newData, updatedAt: now } as Element;
}

export function rotateElement(
    element: Element,
    angleDelta: number,
    center: Point,
): Element {
    const now = new Date().toISOString();
    const newData = { ...element.data } as Record<string, unknown>;

    // Update rotation if present
    if ('rotation' in newData) {
        newData.rotation =
            ((newData.rotation as number) + angleDelta) % 360;
    }

    // Rotate position around center if present
    if ('position' in newData) {
        const pos = newData.position as Point;
        newData.position = rotatePoint(pos, center, angleDelta);
    }

    // Update bounds after rotation
    if ('bounds' in newData && 'position' in newData) {
        const pos = newData.position as Point;
        const bounds = newData.bounds as Rect;
        newData.bounds = { ...bounds, x: pos.x, y: pos.y };
    }

    return { ...element, data: newData, updatedAt: now } as Element;
}

function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}
