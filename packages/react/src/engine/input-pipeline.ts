import type { InputEvent } from '@hfu.digital/boardkit-core';
import type { Point } from '@hfu.digital/boardkit-core';
import type { ViewportState } from './viewport';
import { screenToWorld } from './viewport';

export class InputPipeline {
    private canvas: HTMLCanvasElement;
    private viewport: ViewportState;
    private attached = false;

    onInput: ((event: InputEvent) => void) | null = null;
    onViewportChange: ((gesture: 'pan' | 'zoom', delta: Point | number) => void) | null = null;

    private boundHandlers: {
        pointerdown: (e: PointerEvent) => void;
        pointermove: (e: PointerEvent) => void;
        pointerup: (e: PointerEvent) => void;
        pointercancel: (e: PointerEvent) => void;
        wheel: (e: WheelEvent) => void;
        contextmenu: (e: Event) => void;
    };

    private isSpaceDown = false;
    private isPanning = false;
    private lastPanPos: Point | null = null;

    constructor(canvas: HTMLCanvasElement, viewport: ViewportState) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.boundHandlers = {
            pointerdown: this.handlePointerDown.bind(this),
            pointermove: this.handlePointerMove.bind(this),
            pointerup: this.handlePointerUp.bind(this),
            pointercancel: this.handlePointerCancel.bind(this),
            wheel: this.handleWheel.bind(this),
            contextmenu: (e: Event) => e.preventDefault(),
        };
    }

    updateViewport(viewport: ViewportState): void {
        this.viewport = viewport;
    }

    attach(): void {
        if (this.attached) return;
        this.attached = true;
        const c = this.canvas;
        c.addEventListener('pointerdown', this.boundHandlers.pointerdown);
        c.addEventListener('pointermove', this.boundHandlers.pointermove);
        c.addEventListener('pointerup', this.boundHandlers.pointerup);
        c.addEventListener('pointercancel', this.boundHandlers.pointercancel);
        c.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        c.addEventListener('contextmenu', this.boundHandlers.contextmenu);

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    detach(): void {
        if (!this.attached) return;
        this.attached = false;
        const c = this.canvas;
        c.removeEventListener('pointerdown', this.boundHandlers.pointerdown);
        c.removeEventListener('pointermove', this.boundHandlers.pointermove);
        c.removeEventListener('pointerup', this.boundHandlers.pointerup);
        c.removeEventListener('pointercancel', this.boundHandlers.pointercancel);
        c.removeEventListener('wheel', this.boundHandlers.wheel);
        c.removeEventListener('contextmenu', this.boundHandlers.contextmenu);

        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.code === 'Space' && !e.repeat) {
            this.isSpaceDown = true;
        }
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        if (e.code === 'Space') {
            this.isSpaceDown = false;
            this.isPanning = false;
            this.lastPanPos = null;
        }
    };

    private handlePointerDown(e: PointerEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const screenPos: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        // Middle button or space+left = pan
        if (e.button === 1 || (this.isSpaceDown && e.button === 0)) {
            this.isPanning = true;
            this.lastPanPos = screenPos;
            this.canvas.setPointerCapture(e.pointerId);
            return;
        }

        const worldPos = screenToWorld(screenPos, this.viewport);
        this.canvas.setPointerCapture(e.pointerId);
        this.onInput?.({
            type: 'pointerDown',
            position: worldPos,
            pressure: e.pressure,
            tilt: { x: e.tiltX, y: e.tiltY },
            button: e.button,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            },
            timestamp: e.timeStamp,
        });
    }

    private handlePointerMove(e: PointerEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const screenPos: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (this.isPanning && this.lastPanPos) {
            const dx = screenPos.x - this.lastPanPos.x;
            const dy = screenPos.y - this.lastPanPos.y;
            this.lastPanPos = screenPos;
            this.onViewportChange?.('pan', { x: dx, y: dy });
            return;
        }

        const worldPos = screenToWorld(screenPos, this.viewport);
        this.onInput?.({
            type: 'pointerMove',
            position: worldPos,
            pressure: e.pressure,
            tilt: { x: e.tiltX, y: e.tiltY },
            button: e.button,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            },
            timestamp: e.timeStamp,
        });
    }

    private handlePointerUp(e: PointerEvent): void {
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPos = null;
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const screenPos: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldPos = screenToWorld(screenPos, this.viewport);

        this.onInput?.({
            type: 'pointerUp',
            position: worldPos,
            pressure: e.pressure,
            tilt: { x: e.tiltX, y: e.tiltY },
            button: e.button,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            },
            timestamp: e.timeStamp,
        });
    }

    private handlePointerCancel(e: PointerEvent): void {
        this.isPanning = false;
        this.lastPanPos = null;

        const rect = this.canvas.getBoundingClientRect();
        const worldPos = screenToWorld(
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
            this.viewport,
        );

        this.onInput?.({
            type: 'pointerCancel',
            position: worldPos,
            pressure: 0,
            button: e.button,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            },
            timestamp: e.timeStamp,
        });
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        this.onViewportChange?.('zoom', delta);
    }
}
