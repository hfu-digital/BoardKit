import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputPipeline } from '../engine/input-pipeline';
import type { ViewportState } from '../engine/viewport';
import type { Point } from '@hfu.digital/boardkit-core';

// `InputPipeline.attach` registers keydown/keyup on `window` (for space-pan
// detection). Stub a minimal window shim since the default vitest env is node.
const installWindow = () => {
    const listeners = new Map<string, Set<(e: any) => void>>();
    (globalThis as any).window = {
        addEventListener(type: string, fn: (e: any) => void): void {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(fn);
        },
        removeEventListener(type: string, fn: (e: any) => void): void {
            listeners.get(type)?.delete(fn);
        },
    };
};
const uninstallWindow = () => {
    delete (globalThis as any).window;
};

type ViewportEvent = {
    gesture: 'pan' | 'zoom';
    delta: Point | number;
    cursor?: Point;
};

class MockCanvas {
    listeners = new Map<string, Set<(e: any) => void>>();

    addEventListener(type: string, fn: (e: any) => void): void {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(fn);
    }

    removeEventListener(type: string, fn: (e: any) => void): void {
        this.listeners.get(type)?.delete(fn);
    }

    setPointerCapture(): void {}
    releasePointerCapture(): void {}

    getBoundingClientRect(): DOMRect {
        return {
            left: 50,
            top: 100,
            right: 850,
            bottom: 700,
            width: 800,
            height: 600,
            x: 50,
            y: 100,
            toJSON: () => ({}),
        };
    }

    dispatch(type: string, event: any): void {
        const fns = this.listeners.get(type);
        if (!fns) return;
        for (const fn of fns) fn(event);
    }
}

function makeWheelEvent(init: Partial<WheelEventInit & {
    deltaMode?: number;
    deltaX?: number;
    deltaY?: number;
    clientX?: number;
    clientY?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}>): WheelEvent {
    return {
        deltaX: init.deltaX ?? 0,
        deltaY: init.deltaY ?? 0,
        deltaMode: init.deltaMode ?? 0,
        clientX: init.clientX ?? 250,
        clientY: init.clientY ?? 300,
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
        shiftKey: init.shiftKey ?? false,
        preventDefault: vi.fn(),
    } as unknown as WheelEvent;
}

describe('InputPipeline.handleWheel', () => {
    let canvas: MockCanvas;
    let pipeline: InputPipeline;
    let events: ViewportEvent[];
    const viewport: ViewportState = { offset: { x: 0, y: 0 }, zoom: 1 };

    beforeEach(() => {
        installWindow();
        canvas = new MockCanvas();
        pipeline = new InputPipeline(canvas as unknown as HTMLCanvasElement, viewport);
        events = [];
        pipeline.onViewportChange = (gesture, delta, cursor) => {
            events.push({ gesture, delta, cursor });
        };
        pipeline.attach();
    });

    afterEach(() => {
        pipeline.detach();
        uninstallWindow();
    });

    it('two-finger trackpad scroll (no modifier) emits a pan with negated deltas', () => {
        canvas.dispatch('wheel', makeWheelEvent({ deltaX: 12, deltaY: 24 }));

        expect(events).toHaveLength(1);
        expect(events[0].gesture).toBe('pan');
        expect(events[0].delta).toEqual({ x: -12, y: -24 });
    });

    it('ctrlKey wheel (macOS pinch) emits a zoom with cursor in canvas-local coords', () => {
        canvas.dispatch(
            'wheel',
            makeWheelEvent({ deltaY: 10, ctrlKey: true, clientX: 250, clientY: 300 }),
        );

        expect(events).toHaveLength(1);
        expect(events[0].gesture).toBe('zoom');
        // ZOOM_INTENSITY = 0.01 → -10 * 0.01 = -0.1
        expect(events[0].delta).toBeCloseTo(-0.1, 5);
        // Canvas rect is at (50, 100); cursor in canvas-local space is (200, 200).
        expect(events[0].cursor).toEqual({ x: 200, y: 200 });
    });

    it('metaKey wheel (Cmd+scroll on Mac) routes to zoom, not pan', () => {
        canvas.dispatch('wheel', makeWheelEvent({ deltaY: 5, metaKey: true }));

        expect(events).toHaveLength(1);
        expect(events[0].gesture).toBe('zoom');
    });

    it('deltaMode === 1 (line) is normalized to 16px units in pan mode', () => {
        canvas.dispatch('wheel', makeWheelEvent({ deltaY: 3, deltaMode: 1 }));

        expect(events[0].gesture).toBe('pan');
        expect(events[0].delta).toEqual({ x: 0, y: -48 });
    });

    it('deltaMode === 2 (page) is normalized to 100px units in pan mode', () => {
        canvas.dispatch('wheel', makeWheelEvent({ deltaY: 1, deltaMode: 2 }));

        expect(events[0].gesture).toBe('pan');
        expect(events[0].delta).toEqual({ x: 0, y: -100 });
    });

    it('shift+wheel with vertical-only delta swaps into horizontal pan', () => {
        canvas.dispatch('wheel', makeWheelEvent({ deltaY: 30, shiftKey: true }));

        expect(events[0].gesture).toBe('pan');
        expect(events[0].delta).toEqual({ x: -30, y: 0 });
    });

    it('shift+wheel with explicit deltaX preserves horizontal axis (no swap)', () => {
        canvas.dispatch(
            'wheel',
            makeWheelEvent({ deltaX: 10, deltaY: 20, shiftKey: true }),
        );

        expect(events[0].gesture).toBe('pan');
        expect(events[0].delta).toEqual({ x: -10, y: -20 });
    });

    it('preventDefault is called on every wheel event', () => {
        const e = makeWheelEvent({ deltaY: 5 });
        canvas.dispatch('wheel', e);
        expect(e.preventDefault).toHaveBeenCalled();
    });
});
