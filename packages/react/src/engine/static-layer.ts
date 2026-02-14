import type { Element } from '@boardkit/core';
import type { ViewportState } from './viewport';
import { applyViewportTransform } from './viewport';
import { renderStroke } from './element-renderers/stroke.renderer';
import { renderShape } from './element-renderers/shape.renderer';
import { renderText } from './element-renderers/text.renderer';
import { renderImage } from './element-renderers/image.renderer';
import { renderStickyNote } from './element-renderers/sticky-note.renderer';
import { renderConnector } from './element-renderers/connector.renderer';

export function renderStaticLayer(
    ctx: CanvasRenderingContext2D,
    elements: Element[],
    viewport: ViewportState,
    elementsMap?: Map<string, Element>,
): void {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    applyViewportTransform(ctx, viewport);

    // Build elements map if not provided (needed for connector rendering)
    const map = elementsMap ?? new Map(elements.map((el) => [el.id, el]));

    // First pass: render non-connector elements
    for (const element of elements) {
        if (element.type !== 'connector') {
            renderElement(ctx, element);
        }
    }

    // Second pass: render connectors (they need to look up connected elements)
    for (const element of elements) {
        if (element.type === 'connector') {
            renderConnector(ctx, element, map);
        }
    }

    ctx.restore();
}

export function renderElement(
    ctx: CanvasRenderingContext2D,
    element: Element,
): void {
    switch (element.type) {
        case 'stroke':
            renderStroke(ctx, element);
            break;
        case 'shape':
            renderShape(ctx, element);
            break;
        case 'text':
            renderText(ctx, element);
            break;
        case 'image':
            renderImage(ctx, element);
            break;
        case 'stickyNote':
            renderStickyNote(ctx, element);
            break;
        case 'connector':
            // Connectors are rendered in the second pass of renderStaticLayer
            break;
        case 'group':
            // Groups don't render themselves, children render individually
            break;
    }
}
