import type { LinearElement, Point } from '@hfu.digital/boardkit-core';
import { getRoughCanvas, strokeStyleToRoughOptions } from '../roughjs-helpers';

/**
 * Hybrid line/arrow renderer. Mirrors shape.renderer's roughness===0
 * fast-path: clean strokes when "architect", Rough.js polylines when
 * "artist" or "cartoonist".
 *
 * `pointsOverride` lets the caller pass already-resolved binding endpoints
 * (see `resolveLinearEndpoints`) so we draw the live geometry — important
 * when a remote shape move arrives before our local follow-on lands.
 */
export function renderLinear(
    ctx: CanvasRenderingContext2D,
    element: LinearElement,
    pointsOverride?: Point[],
): void {
    const points = pointsOverride ?? element.data.points;
    const { style, arrowEnd, arrowStart, roughness, seed } = element.data;
    if (points.length < 2) return;

    if (roughness === 0) {
        renderCrisp(ctx, points, style, arrowStart, arrowEnd);
    } else {
        renderRough(ctx, element, points);
    }
}

function renderCrisp(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    style: LinearElement['data']['style'],
    arrowStart: boolean,
    arrowEnd: boolean,
): void {
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = style.opacity;
    if (style.pattern === 'dashed') ctx.setLineDash([10, 5]);
    else if (style.pattern === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    drawArrowheads(ctx, points, style.width, arrowStart, arrowEnd);
    ctx.restore();
}

function renderRough(
    ctx: CanvasRenderingContext2D,
    element: LinearElement,
    points: Point[],
): void {
    const { style, arrowEnd, arrowStart, roughness, seed } = element.data;
    const rc = getRoughCanvas(ctx);
    const options = strokeStyleToRoughOptions(style, roughness, seed);
    rc.linearPath(points.map((p) => [p.x, p.y]), options);

    // Arrowheads stay crisp — Rough.js arrows look messy and Excalidraw does
    // the same (sketchy line + clean head). Use the original ctx, no Rough.
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = style.opacity;
    drawArrowheads(ctx, points, style.width, arrowStart, arrowEnd);
    ctx.restore();
}

function drawArrowheads(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    strokeWidth: number,
    arrowStart: boolean,
    arrowEnd: boolean,
): void {
    const size = Math.max(strokeWidth * 4, 12);
    if (arrowEnd) drawArrowhead(ctx, points[points.length - 2], points[points.length - 1], size);
    if (arrowStart) drawArrowhead(ctx, points[1], points[0], size);
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
