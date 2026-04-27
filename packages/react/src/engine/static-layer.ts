import type { Element } from '@hfu.digital/boardkit-core';
import type { ViewportState } from './viewport';
import { applyViewportTransform } from './viewport';
import { renderStroke } from './element-renderers/stroke.renderer';
import { renderShape } from './element-renderers/shape.renderer';
import { renderText } from './element-renderers/text.renderer';
import { renderImage } from './element-renderers/image.renderer';
import { renderLinear } from './element-renderers/linear.renderer';

export function renderStaticLayer(
    ctx: CanvasRenderingContext2D,
    elements: Element[],
    viewport: ViewportState,
    _elementsMap?: Map<string, Element>,
): void {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    applyViewportTransform(ctx, viewport);

    for (const element of elements) {
        renderElement(ctx, element);
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
        case 'linear':
            renderLinear(ctx, element);
            break;
        case 'text':
            renderText(ctx, element);
            break;
        case 'image':
            renderImage(ctx, element);
            break;
        case 'group':
            // Groups don't render themselves; children render individually.
            break;
    }
}
