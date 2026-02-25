import type { Point } from '@hfu.digital/boardkit-core';

export interface MouseGestureCallbacks {
    onPanStart: (position: Point) => void;
    onPanMove: (delta: Point) => void;
    onPanEnd: () => void;
    onZoom: (delta: number, center: Point) => void;
}

export class MouseHandler {
    private isPanning = false;
    private lastPos: Point | null = null;

    constructor(private callbacks: MouseGestureCallbacks) {}

    handleMiddleDown(position: Point): void {
        this.isPanning = true;
        this.lastPos = position;
        this.callbacks.onPanStart(position);
    }

    handleMiddleMove(position: Point): void {
        if (!this.isPanning || !this.lastPos) return;
        const delta = {
            x: position.x - this.lastPos.x,
            y: position.y - this.lastPos.y,
        };
        this.lastPos = position;
        this.callbacks.onPanMove(delta);
    }

    handleMiddleUp(): void {
        this.isPanning = false;
        this.lastPos = null;
        this.callbacks.onPanEnd();
    }

    handleWheel(deltaY: number, center: Point): void {
        const zoomDelta = -deltaY * 0.001;
        this.callbacks.onZoom(zoomDelta, center);
    }
}
