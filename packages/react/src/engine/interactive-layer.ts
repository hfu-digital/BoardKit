import type {
    BindingPreview,
    Element,
    Rect,
    Point,
    ShapeElement,
} from '@hfu.digital/boardkit-core';
import type { CursorPosition } from '@hfu.digital/boardkit-core';
import {
    calculateBounds,
    getSelectionHandleRects,
    mergeBounds,
} from '@hfu.digital/boardkit-core';
import type { ViewportState } from './viewport';
import { applyViewportTransform, worldToScreen } from './viewport';
import { renderElement } from './static-layer';
import { drawShapePath } from './element-renderers/shape.renderer';

export function renderInteractiveLayer(
    ctx: CanvasRenderingContext2D,
    preview: Element[],
    cursors: CursorPosition[],
    selections: Rect[],
    selectedIds: Set<string>,
    elements: Map<string, Element>,
    viewport: ViewportState,
    participantColors: Map<string, { color: string; name: string }>,
    bindingPreviews: BindingPreview[] = [],
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

    // Render selection chrome around the merged bounds of all selected
    // elements: a single bbox + 8 resize handles (4 corners + 4 edge mids).
    // Handle geometry is shared with SelectTool's hit-test via
    // getSelectionHandleRects so visible handle position == clickable rect.
    if (selectedIds.size > 0) {
        const selectedEls: Element[] = [];
        for (const id of selectedIds) {
            const el = elements.get(id);
            if (el) selectedEls.push(el);
        }
        if (selectedEls.length > 0) {
            const merged = mergeBounds(selectedEls.map(calculateBounds));
            renderSelectionChrome(ctx, merged, viewport.zoom);
        }
    }

    // Render preview elements (active stroke, shape being drawn). Pass a
    // transient scene built from the live elements map so any preview-time
    // linear elements with bindings render against current shape positions.
    const previewScene = { elements, elementOrder: [] as string[] };
    for (const element of preview) {
        renderElement(ctx, element, previewScene);
    }

    // Render binding hints emitted by LinearTool while dragging the arrow/
    // line tool over a candidate shape: a perimeter outline on the target
    // shape plus a dot at the snap-point.
    for (const bp of bindingPreviews) {
        const shape = elements.get(bp.candidateShapeId);
        if (!shape || shape.type !== 'shape') continue;
        renderBindingPreview(ctx, shape, bp.anchorPoint, viewport.zoom);
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

function renderBindingPreview(
    ctx: CanvasRenderingContext2D,
    shape: ShapeElement,
    anchor: Point,
    zoom: number,
): void {
    const { position, size, rotation, shapeType, style } = shape.data;
    const cx = position.x + size.width / 2;
    const cy = position.y + size.height / 2;
    const accent = '#2196F3';

    ctx.save();
    if (rotation !== 0) {
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([]);
    drawShapePath(
        ctx,
        shapeType,
        position.x,
        position.y,
        size.width,
        size.height,
        style.cornerRadius,
    );
    ctx.stroke();
    ctx.restore();

    // Anchor dot in world space (no rotation transform — anchor is already
    // a world-space point).
    ctx.save();
    ctx.fillStyle = accent;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 5 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function renderSelectionChrome(
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    zoom: number,
): void {
    ctx.save();
    ctx.strokeStyle = '#2196F3';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 / zoom;

    // Bounding box around all selected elements.
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // 8 resize handles (4 corners + 4 edge midpoints). Same source of truth
    // as SelectTool's hit-test.
    const handles = getSelectionHandleRects(bounds, zoom);
    for (const rect of Object.values(handles)) {
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.restore();
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
