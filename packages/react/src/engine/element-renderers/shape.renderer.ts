import type { ShapeElement } from '@boardkit/core';

export function renderShape(
    ctx: CanvasRenderingContext2D,
    element: ShapeElement,
): void {
    const { shapeType, position, size, rotation, style } = element.data;

    ctx.save();
    ctx.translate(position.x + size.width / 2, position.y + size.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(size.width / 2), -(size.height / 2));

    // Fill
    if (style.fill.type === 'solid') {
        ctx.fillStyle = style.fill.color;
        ctx.globalAlpha = style.fill.opacity;
        drawShapePath(ctx, shapeType, size.width, size.height);
        ctx.fill();
    }

    // Stroke
    ctx.strokeStyle = style.stroke.color;
    ctx.lineWidth = style.stroke.width;
    ctx.lineCap = style.stroke.lineCap;
    ctx.lineJoin = style.stroke.lineJoin;
    ctx.globalAlpha = style.stroke.opacity;
    drawShapePath(ctx, shapeType, size.width, size.height);
    ctx.stroke();

    ctx.restore();
}

function drawShapePath(
    ctx: CanvasRenderingContext2D,
    shapeType: string,
    width: number,
    height: number,
): void {
    ctx.beginPath();
    switch (shapeType) {
        case 'rectangle':
            ctx.rect(0, 0, width, height);
            break;
        case 'ellipse':
            ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            break;
        case 'triangle':
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            break;
        case 'line':
            ctx.moveTo(0, 0);
            ctx.lineTo(width, height);
            break;
        case 'arrow': {
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width - 10, height / 2);
            // Arrowhead
            ctx.moveTo(width, height / 2);
            ctx.lineTo(width - 15, height / 2 - 8);
            ctx.moveTo(width, height / 2);
            ctx.lineTo(width - 15, height / 2 + 8);
            break;
        }
    }
}
