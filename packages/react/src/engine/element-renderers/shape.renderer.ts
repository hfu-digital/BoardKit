import type { ShapeElement } from '@hfu.digital/boardkit-core';

/**
 * Plain vector shape renderer. M3 will swap this out for Rough.js when
 * `style.roughness > 0`. For now (M2) all shapes draw as crisp vector lines
 * regardless of roughness — the field exists on the data model but isn't
 * read here yet.
 */
export function renderShape(
    ctx: CanvasRenderingContext2D,
    element: ShapeElement,
): void {
    const { shapeType, position, size, rotation, style } = element.data;

    ctx.save();
    ctx.translate(position.x + size.width / 2, position.y + size.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(size.width / 2), -(size.height / 2));

    if (style.fill.type !== 'none') {
        ctx.fillStyle = style.fill.color;
        ctx.globalAlpha = style.fill.opacity;
        drawShapePath(ctx, shapeType, size.width, size.height);
        ctx.fill();
    }

    ctx.strokeStyle = style.stroke.color;
    ctx.lineWidth = style.stroke.width;
    ctx.lineCap = style.stroke.lineCap;
    ctx.lineJoin = style.stroke.lineJoin;
    ctx.globalAlpha = style.stroke.opacity;
    if (style.stroke.pattern === 'dashed') {
        ctx.setLineDash([10, 5]);
    } else if (style.stroke.pattern === 'dotted') {
        ctx.setLineDash([2, 4]);
    } else {
        ctx.setLineDash([]);
    }
    drawShapePath(ctx, shapeType, size.width, size.height, style.cornerRadius);
    ctx.stroke();

    ctx.restore();
}

function drawShapePath(
    ctx: CanvasRenderingContext2D,
    shapeType: 'rectangle' | 'diamond' | 'ellipse',
    width: number,
    height: number,
    cornerRadius = 0,
): void {
    ctx.beginPath();
    switch (shapeType) {
        case 'rectangle': {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            if (r > 0 && typeof (ctx as any).roundRect === 'function') {
                (ctx as any).roundRect(0, 0, width, height, r);
            } else {
                ctx.rect(0, 0, width, height);
            }
            break;
        }
        case 'diamond':
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width, height / 2);
            ctx.lineTo(width / 2, height);
            ctx.lineTo(0, height / 2);
            ctx.closePath();
            break;
        case 'ellipse':
            ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            break;
    }
}
