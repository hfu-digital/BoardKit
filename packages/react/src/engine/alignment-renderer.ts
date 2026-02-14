import type { AlignmentGuide } from '@boardkit/core';
import type { ViewportState } from './viewport';
import { worldToScreen } from './viewport';

export function renderAlignmentGuides(
    ctx: CanvasRenderingContext2D,
    guides: AlignmentGuide[],
    viewport: ViewportState,
): void {
    if (guides.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#FF4081';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (const guide of guides) {
        ctx.beginPath();
        if (guide.type === 'vertical') {
            const start = worldToScreen({ x: guide.position, y: guide.start }, viewport);
            const end = worldToScreen({ x: guide.position, y: guide.end }, viewport);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        } else {
            const start = worldToScreen({ x: guide.start, y: guide.position }, viewport);
            const end = worldToScreen({ x: guide.end, y: guide.position }, viewport);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        }
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
}
