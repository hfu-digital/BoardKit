import type { Element, Rect, SceneState } from '@hfu.digital/boardkit-core';
import { resolveLinearEndpoints } from '@hfu.digital/boardkit-core';
import type { ViewportState } from './viewport';

/** Paint bounds, never persisted bounds (bindings/rotation can make those stale).
 * Text can overflow its box and Rough.js has no guaranteed paint envelope;
 * conservatively draw those instead of clipping visible pixels.
 */
export function isElementVisible(element: Element, viewport: ViewportState, width: number, height: number, scene: SceneState): boolean {
    if (!(viewport.zoom > 0)) return true;
    let bounds: Rect;
    let padding = 2 / viewport.zoom;
    if (element.type === 'text') return true;
    if (element.type === 'group') return false;
    if (element.type === 'shape' || element.type === 'image') {
        const { position, size, rotation } = element.data;
        if (element.type === 'shape') {
            if (element.data.style.roughness !== 0) return true;
            padding += Math.abs(element.data.style.stroke.width) * 10;
        }
        const angle = rotation * Math.PI / 180;
        const w = Math.abs(size.width * Math.cos(angle)) + Math.abs(size.height * Math.sin(angle));
        const h = Math.abs(size.width * Math.sin(angle)) + Math.abs(size.height * Math.cos(angle));
        bounds = { x: position.x + size.width / 2 - w / 2, y: position.y + size.height / 2 - h / 2, width: w, height: h };
    } else {
        if (element.type === 'linear' && element.data.roughness !== 0) return true;
        if (element.data.points.length < 2) return false;
        const points = element.type === 'linear' ? resolveLinearEndpoints(element, scene) : element.data.points;
        if (!points.length) return false;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
        bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        let pressure = 1;
        if (element.type === 'stroke') for (const p of element.data.pressures ?? []) pressure = Math.max(pressure, Math.abs(0.3 + p * 1.2));
        padding += Math.max(12, Math.abs(element.data.style.width) * pressure * 10);
    }
    if (![bounds.x, bounds.y, bounds.width, bounds.height, padding].every(Number.isFinite)) return true;
    const left = -viewport.offset.x / viewport.zoom, top = -viewport.offset.y / viewport.zoom;
    return bounds.x - padding <= left + width / viewport.zoom && bounds.x + bounds.width + padding >= left
        && bounds.y - padding <= top + height / viewport.zoom && bounds.y + bounds.height + padding >= top;
}
