import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Canvas2DRenderer } from '../engine/canvas-2d-renderer';
import { shape, image, text, line } from '../specialized/elements';
import { isElementVisible } from '../engine/visibility';
import type { RenderContext } from '@hfu.digital/boardkit-core';

const context: RenderContext = { viewport: { offset: { x: 0, y: 0 }, zoom: 1 }, selectedIds: new Set(), activeTool: 'select' };
let frames: Map<number, FrameRequestCallback>, next: number, fonts: EventTarget;
let canvases: HTMLCanvasElement[];
let images: FakeImage[];
class FakeImage {
    src = ''; naturalWidth = 10;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { images.push(this); }
}
function flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(0)); }
function mount() {
    const renderer = new Canvas2DRenderer();
    renderer.initialize({ style: {}, clientWidth: 100, clientHeight: 100, appendChild: vi.fn() } as unknown as HTMLElement);
    return renderer;
}
beforeEach(() => {
    frames = new Map(); next = 0; canvases = []; images = []; fonts = new EventTarget(); Object.assign(fonts, { ready: new Promise(() => {}) });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++next, cb); return next; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', { fonts, createElement: () => {
        const canvas = { style: {}, width: 0, height: 0, remove: vi.fn(), toDataURL: vi.fn(() => 'snapshot') };
        const ctx = new Proxy({ canvas }, { get(target, key) {
            if (!(key in target)) Object.assign(target, { [key]: vi.fn() });
            return Reflect.get(target, key);
        } });
        Object.assign(canvas, { getContext: () => ctx });
        canvases.push(canvas as unknown as HTMLCanvasElement);
        return canvas;
    } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('dirty frames and resource lifetime', () => {
    it('coalesces updates, stays idle, redraws only changed layers and cancels on teardown', () => {
        const renderer = mount();
        renderer.renderStaticLayer([shape('p', 'u', 0, 0, 20, 20)], context);
        renderer.invalidateScene();
        expect(frames.size).toBe(1);
        flush(); expect(frames.size).toBe(0);
        const staticCtx = canvases[0].getContext('2d')!;
        const interactiveCtx = canvases[1].getContext('2d')!;
        expect(staticCtx.clearRect).toHaveBeenCalledTimes(1);
        renderer.renderInteractiveLayer([], [], [{ x: 0, y: 0, width: 5, height: 5 }], context);
        flush();
        expect(staticCtx.clearRect).toHaveBeenCalledTimes(1);
        expect(interactiveCtx.strokeRect).toHaveBeenCalled();
        renderer.setCursors([]); renderer.setParticipantColors(new Map()); flush();
        expect(interactiveCtx.clearRect).toHaveBeenCalledTimes(3);
        fonts.dispatchEvent(new Event('loadingdone')); flush();
        expect(staticCtx.clearRect).toHaveBeenCalledTimes(2);
        renderer.renderInteractiveLayer([], [], [], { ...context, viewport: { zoom: 2, offset: { x: 5, y: 10 } } });
        flush(); expect(staticCtx.clearRect).toHaveBeenCalledTimes(3);
        expect(staticCtx.transform).toHaveBeenLastCalledWith(2, 0, 0, 2, 5, 10);
        renderer.resize(200, 100); renderer.toDataURL();
        expect(staticCtx.clearRect).toHaveBeenCalledTimes(4);
        renderer.destroy(); expect(frames.size).toBe(0);
        fonts.dispatchEvent(new Event('loadingdone')); expect(frames.size).toBe(0);
    });
    it('culls offscreen shapes without hiding rotated geometry or changing paint order', () => {
        const renderer = mount();
        const visible = shape('p', 'u', 10, 10, 20, 20);
        const outside = shape('p', 'u', 1000, 1000, 20, 20);
        renderer.renderStaticLayer([...Array.from({ length: 1000 }, () => outside), visible], context); flush();
        expect(canvases[0].getContext('2d')!.fill).toHaveBeenCalledTimes(1);
        const scene = { elements: new Map(), elementOrder: [] };
        const rotated = shape('p', 'u', 130, 0, 20, 200); rotated.data.rotation = 90;
        expect(isElementVisible(rotated, context.viewport, 100, 100, scene)).toBe(true);
        expect(isElementVisible(text('p', 'u', -1000, 0, 'overflow'), context.viewport, 100, 100, scene)).toBe(true);
        const bound = line('p', 'u', [{ x: 1000, y: 1000 }, { x: 1500, y: 1000 }], true);
        bound.data.startBinding = { elementId: visible.id };
        const boundScene = { elements: new Map([[visible.id, visible]]), elementOrder: [visible.id] };
        expect(isElementVisible(bound, context.viewport, 100, 100, boundScene)).toBe(true);
        const edge = line('p', 'u', [{ x: 105, y: 50 }, { x: 200, y: 50 }], true);
        edge.data.arrowStart = true;
        expect(isElementVisible(edge, context.viewport, 100, 100, scene)).toBe(true);
        renderer.renderInteractiveLayer([], [], [], { ...context, selectedIds: new Set([visible.id]) }); flush();
        expect(canvases[1].getContext('2d')!.strokeRect).toHaveBeenCalledTimes(9);
        renderer.destroy();
    });
    it('redraws decoded preview images, isolates providers, releases removed images and ignores late loads', () => {
        const a = mount(), b = mount();
        const element = image('p', 'u', 0, 0, 20, 20, 'data:image/png;base64,AA', 'asset');
        a.renderInteractiveLayer([element], [], [], context);
        b.renderStaticLayer([element], context); flush();
        expect(images).toHaveLength(2);
        const lateLoad = images[0].onload!;
        a.destroy(); expect(images[0].src).toBe('');
        lateLoad(); expect(frames.size).toBe(0);
        images[1].onload!(); flush();
        expect(canvases[2].getContext('2d')!.drawImage).toHaveBeenCalledTimes(1);
        b.renderStaticLayer([], context); flush();
        expect(images[1].src).toBe('');
        b.destroy();
    });
    it('retries failed decoding on a deadline without a permanent animation loop', () => {
        vi.useFakeTimers();
        const renderer = mount();
        renderer.renderStaticLayer([image('p', 'u', 0, 0, 20, 20, 'data:x', 'asset')], context); flush();
        images[0].onerror!(); expect(frames.size).toBe(0);
        vi.advanceTimersByTime(5000); expect(frames.size).toBe(1); flush();
        expect(images).toHaveLength(2);
        images[1].onerror!(); renderer.destroy();
        expect(vi.getTimerCount()).toBe(0);
    });
});
