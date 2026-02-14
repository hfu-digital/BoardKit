import type { StickyNoteElement } from '@boardkit/core';

export function renderStickyNote(
    ctx: CanvasRenderingContext2D,
    element: StickyNoteElement,
): void {
    const { content, position, size, color, style } = element.data;

    ctx.save();

    // Background
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillRect(position.x, position.y, size.width, size.height);
    ctx.shadowColor = 'transparent';

    // Text
    if (content) {
        ctx.fillStyle = style.color;
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'top';

        const padding = 8;
        const x = style.textAlign === 'center'
            ? position.x + size.width / 2
            : style.textAlign === 'right'
                ? position.x + size.width - padding
                : position.x + padding;

        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.3;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, position.y + padding + i * lineHeight);
        }
    }

    ctx.restore();
}
