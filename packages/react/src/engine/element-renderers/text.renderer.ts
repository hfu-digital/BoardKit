import type { TextElement } from '@boardkit/core';

export function renderText(
    ctx: CanvasRenderingContext2D,
    element: TextElement,
): void {
    const { content, position, size, rotation, style } = element.data;
    if (!content) return;

    ctx.save();
    ctx.translate(position.x + size.width / 2, position.y + size.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(size.width / 2), -(size.height / 2));

    ctx.fillStyle = style.color;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = style.textAlign;
    ctx.textBaseline = 'top';

    const x = style.textAlign === 'center' ? size.width / 2 : style.textAlign === 'right' ? size.width : 0;

    const lines = content.split('\n');
    const lineHeight = style.fontSize * 1.3;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, i * lineHeight);
    }

    ctx.restore();
}
