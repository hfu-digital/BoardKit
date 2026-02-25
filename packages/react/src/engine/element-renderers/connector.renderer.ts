import type { ConnectorElement, Element, Point, Rect } from '@hfu.digital/boardkit-core';

function getAnchorPositionFromBounds(bounds: Rect, anchor: string): Point {
    switch (anchor) {
        case 'top':
            return { x: bounds.x + bounds.width / 2, y: bounds.y };
        case 'right':
            return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
        case 'bottom':
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
        case 'left':
            return { x: bounds.x, y: bounds.y + bounds.height / 2 };
        case 'center':
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        default:
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }
}

function getElementBounds(element: Element): Rect {
    return element.data.bounds;
}

function drawArrowhead(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    size: number,
): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
        to.x - size * Math.cos(angle - Math.PI / 6),
        to.y - size * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
        to.x - size * Math.cos(angle + Math.PI / 6),
        to.y - size * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
}

export function renderConnector(
    ctx: CanvasRenderingContext2D,
    element: ConnectorElement,
    elements: Map<string, Element>,
): void {
    const { startElementId, endElementId, startAnchor, endAnchor, waypoints, style, arrowStart, arrowEnd } = element.data;

    // Resolve start and end points from connected elements if available,
    // otherwise fall back to stored waypoints
    let startPoint: Point | null = null;
    let endPoint: Point | null = null;

    const startEl = elements.get(startElementId);
    if (startEl) {
        const bounds = getElementBounds(startEl);
        startPoint = getAnchorPositionFromBounds(bounds, startAnchor);
    }

    const endEl = elements.get(endElementId);
    if (endEl) {
        const bounds = getElementBounds(endEl);
        endPoint = getAnchorPositionFromBounds(bounds, endAnchor);
    }

    // Fall back to waypoints if element lookup failed
    if (!startPoint && waypoints.length > 0) {
        startPoint = waypoints[0];
    }
    if (!endPoint && waypoints.length > 1) {
        endPoint = waypoints[waypoints.length - 1];
    }

    // Cannot render without at least two points
    if (!startPoint || !endPoint) return;

    ctx.save();

    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = style.opacity;

    // Draw the connector line through waypoints
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);

    // If there are intermediate waypoints, draw through them
    if (waypoints.length > 2) {
        for (let i = 1; i < waypoints.length - 1; i++) {
            ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
    }

    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    // Draw arrowheads
    const arrowSize = Math.max(style.width * 3, 10);

    if (arrowStart) {
        const secondPoint = waypoints.length > 2 ? waypoints[1] : endPoint;
        drawArrowhead(ctx, secondPoint, startPoint, arrowSize);
    }

    if (arrowEnd) {
        const secondToLast = waypoints.length > 2
            ? waypoints[waypoints.length - 2]
            : startPoint;
        drawArrowhead(ctx, secondToLast, endPoint, arrowSize);
    }

    ctx.restore();
}
