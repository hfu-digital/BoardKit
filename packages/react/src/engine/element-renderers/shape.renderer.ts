import type { ShapeElement } from '@hfu.digital/boardkit-core';
import { getRoughCanvas, shapeStyleToRoughOptions } from '../roughjs-helpers';

/**
 * Hybrid shape renderer:
 * - When `style.roughness === 0`, draws crisp vector paths via plain Canvas2D
 *   (zero Rough.js overhead, perfect for HFU's clean academic palette).
 * - When `style.roughness > 0`, delegates to Rough.js so the same shape gets
 *   wobbly hand-drawn strokes + hachure fills. The deterministic `seed` field
 *   on ShapeStyle keeps the same shape rendering identically across reloads
 *   and across collaborators.
 */
export function renderShape(
    ctx: CanvasRenderingContext2D,
    element: ShapeElement,
): void {
    const { shapeType, position, size, rotation, style } = element.data;

    ctx.save();
    // Apply rotation around the shape's center. Rough.js draws into the same
    // 2D context so the transform applies to its output too.
    const cx = position.x + size.width / 2;
    const cy = position.y + size.height / 2;
    if (rotation !== 0) {
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
    }

    if (style.roughness === 0) {
        renderCrisp(ctx, element);
    } else {
        renderRough(ctx, element);
    }

    ctx.restore();
}

function renderCrisp(ctx: CanvasRenderingContext2D, element: ShapeElement): void {
    const { shapeType, position, size, style } = element.data;

    if (style.fill.type !== 'none') {
        ctx.fillStyle = style.fill.color;
        ctx.globalAlpha = style.fill.opacity;
        drawShapePath(ctx, shapeType, position.x, position.y, size.width, size.height, style.cornerRadius);
        ctx.fill();
    }

    ctx.globalAlpha = style.stroke.opacity;
    ctx.strokeStyle = style.stroke.color;
    ctx.lineWidth = style.stroke.width;
    ctx.lineCap = style.stroke.lineCap;
    ctx.lineJoin = style.stroke.lineJoin;
    if (style.stroke.pattern === 'dashed') ctx.setLineDash([10, 5]);
    else if (style.stroke.pattern === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);
    drawShapePath(ctx, shapeType, position.x, position.y, size.width, size.height, style.cornerRadius);
    ctx.stroke();
    ctx.setLineDash([]);
}

function renderRough(ctx: CanvasRenderingContext2D, element: ShapeElement): void {
    const { shapeType, position, size, style } = element.data;
    const options = shapeStyleToRoughOptions(style);
    if (!options) return;

    const rc = getRoughCanvas(ctx);
    const x = position.x;
    const y = position.y;
    const w = size.width;
    const h = size.height;

    switch (shapeType) {
        case 'rectangle':
            rc.rectangle(x, y, w, h, options);
            break;
        case 'diamond':
            rc.polygon(
                [
                    [x + w / 2, y],
                    [x + w, y + h / 2],
                    [x + w / 2, y + h],
                    [x, y + h / 2],
                ],
                options,
            );
            break;
        case 'ellipse':
            rc.ellipse(x + w / 2, y + h / 2, w, h, options);
            break;
    }
}

function drawShapePath(
    ctx: CanvasRenderingContext2D,
    shapeType: 'rectangle' | 'diamond' | 'ellipse',
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius = 0,
): void {
    ctx.beginPath();
    switch (shapeType) {
        case 'rectangle': {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            if (r > 0 && typeof (ctx as any).roundRect === 'function') {
                (ctx as any).roundRect(x, y, width, height, r);
            } else {
                ctx.rect(x, y, width, height);
            }
            break;
        }
        case 'diamond':
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width, y + height / 2);
            ctx.lineTo(x + width / 2, y + height);
            ctx.lineTo(x, y + height / 2);
            ctx.closePath();
            break;
        case 'ellipse':
            ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            break;
    }
}
