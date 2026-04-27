import type { LinearElement, Point } from '@hfu.digital/boardkit-core';

/**
 * Plain vector renderer for line + arrow elements. Like the shape renderer,
 * this draws crisp paths today and gets replaced by Rough.js in M3 when
 * `roughness > 0` so the strokes look hand-drawn.
 */
export function renderLinear(
    ctx: CanvasRenderingContext2D,
    element: LinearElement,
): void {
    const { points, style, arrowStart, arrowEnd } = element.data;
    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = style.opacity;
    if (style.pattern === 'dashed') {
        ctx.setLineDash([10, 5]);
    } else if (style.pattern === 'dotted') {
        ctx.setLineDash([2, 4]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const arrowSize = Math.max(style.width * 4, 12);
    if (arrowEnd) {
        drawArrowhead(ctx, points[points.length - 2], points[points.length - 1], arrowSize);
    }
    if (arrowStart) {
        drawArrowhead(ctx, points[1], points[0], arrowSize);
    }

    ctx.restore();
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
