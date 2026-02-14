import type { Element, Point, Rect } from '../types/elements';

export function calculateBounds(element: Element): Rect {
    switch (element.type) {
        case 'stroke':
            return element.data.bounds;
        case 'shape':
            return element.data.bounds;
        case 'text':
            return element.data.bounds;
        case 'image':
            return element.data.bounds;
        case 'stickyNote':
            return element.data.bounds;
        case 'group':
            return element.data.bounds;
    }
}

export function boundsIntersect(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

export function boundsContain(outer: Rect, inner: Rect): boolean {
    return (
        outer.x <= inner.x &&
        outer.y <= inner.y &&
        outer.x + outer.width >= inner.x + inner.width &&
        outer.y + outer.height >= inner.y + inner.height
    );
}

export function pointInBounds(point: Point, bounds: Rect): boolean {
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

export function expandBounds(bounds: Rect, padding: number): Rect {
    return {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
    };
}

export function mergeBounds(bounds: Rect[]): Rect {
    if (bounds.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of bounds) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
