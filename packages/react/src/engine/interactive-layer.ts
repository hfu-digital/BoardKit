import type { Element, Rect, Point } from '@boardkit/core';
import type { CursorPosition } from '@boardkit/core';
import type { ViewportState } from './viewport';
import { applyViewportTransform, worldToScreen } from './viewport';
import { renderElement } from './static-layer';

export function renderInteractiveLayer(
    ctx: CanvasRenderingContext2D,
    preview: Element[],
    cursors: CursorPosition[],
    selections: Rect[],
    selectedIds: Set<string>,
    elements: Map<string, Element>,
    viewport: ViewportState,
    participantColors: Map<string, { color: string; name: string }>,
): void {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    applyViewportTransform(ctx, viewport);

    // Render selection boxes
    for (const rect of selections) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 1 / viewport.zoom;
        ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);
    }

    // Render selection handles on selected elements
    for (const id of selectedIds) {
        const el = elements.get(id);
        if (el && 'bounds' in el.data) {
            const bounds = el.data.bounds as Rect;
            renderSelectionHandles(ctx, bounds, viewport.zoom);
        }
    }

    // Render preview elements (active stroke, shape being drawn)
    for (const element of preview) {
        renderElement(ctx, element);
    }

    ctx.restore();

    // Render remote cursors in screen space
    ctx.save();
    for (const cursor of cursors) {
        const info = participantColors.get(cursor.userId);
        const color = info?.color ?? '#666666';
        const name = info?.name ?? cursor.userId;
        const screenPos = worldToScreen(cursor.position, viewport);
        renderCursor(ctx, screenPos, color, name);
    }
    ctx.restore();
}

function renderSelectionHandles(
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    zoom: number,
): void {
    const handleSize = 8 / zoom;
    ctx.strokeStyle = '#2196F3';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 / zoom;

    // Bounding box
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Corner handles
    const corners: Point[] = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.height },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];

    for (const c of corners) {
        ctx.fillRect(
            c.x - handleSize / 2,
            c.y - handleSize / 2,
            handleSize,
            handleSize,
        );
        ctx.strokeRect(
            c.x - handleSize / 2,
            c.y - handleSize / 2,
            handleSize,
            handleSize,
        );
    }
}

function renderCursor(
    ctx: CanvasRenderingContext2D,
    position: Point,
    color: string,
    name: string,
): void {
    ctx.save();
    ctx.translate(position.x, position.y);

    // Cursor arrow
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(4.5, 12.5);
    ctx.lineTo(8, 20);
    ctx.lineTo(11, 18.5);
    ctx.lineTo(7.5, 11);
    ctx.lineTo(12, 10);
    ctx.closePath();
    ctx.fill();

    // Name label
    ctx.font = '11px sans-serif';
    const textWidth = ctx.measureText(name).width;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(14, 12, textWidth + 8, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 18, 25);

    ctx.restore();
}
