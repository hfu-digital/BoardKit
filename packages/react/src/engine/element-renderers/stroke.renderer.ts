import type { StrokeElement } from '@hfu.digital/boardkit-core';

export function renderStroke(
    ctx: CanvasRenderingContext2D,
    element: StrokeElement,
): void {
    const { points, style, pressures } = element.data;
    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = style.opacity;

    if (pressures && pressures.length === points.length) {
        // Variable width stroke
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const pressure = pressures[i];
            const width = style.width * (0.3 + pressure * 1.2);
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    ctx.restore();
}
