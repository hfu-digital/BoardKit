import type { Element, SceneState } from '@hfu.digital/boardkit-core';
import { resolveLinearEndpoints } from '@hfu.digital/boardkit-core';
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
    elementsMap?: Map<string, Element>,
): void {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    applyViewportTransform(ctx, viewport);

    // Build a transient scene the linear renderer can use to resolve any
    // active endpoint bindings. `elementOrder` is empty because resolution
    // only does Map lookups by id — no order dependence.
    const sceneSource = elementsMap ?? buildElementsMap(elements);
    const scene: SceneState = { elements: sceneSource, elementOrder: [] };

    for (const element of elements) {
        renderElement(ctx, element, scene);
    }

    ctx.restore();
}

export function renderElement(
    ctx: CanvasRenderingContext2D,
    element: Element,
    scene?: SceneState,
): void {
    switch (element.type) {
        case 'stroke':
            renderStroke(ctx, element);
            break;
        case 'shape':
            renderShape(ctx, element);
            break;
        case 'linear': {
            const points = scene
                ? resolveLinearEndpoints(element, scene)
                : undefined;
            renderLinear(ctx, element, points);
            break;
        }
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

function buildElementsMap(elements: Element[]): Map<string, Element> {
    const map = new Map<string, Element>();
    for (const el of elements) map.set(el.id, el);
    return map;
}
