import type { Point } from '@boardkit/core';

export interface TouchGestureCallbacks {
    onPanMove: (delta: Point) => void;
    onPinchZoom: (delta: number, center: Point) => void;
}

function distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class TouchHandler {
    private lastTouches: Point[] = [];
    private lastPinchDist = 0;

    constructor(private callbacks: TouchGestureCallbacks) {}

    handleTouchStart(touches: Point[]): void {
        this.lastTouches = [...touches];
        if (touches.length >= 2) {
            this.lastPinchDist = distance(touches[0], touches[1]);
        }
    }

    handleTouchMove(touches: Point[]): void {
        if (touches.length >= 2 && this.lastTouches.length >= 2) {
            const currentDist = distance(touches[0], touches[1]);
            const center = midpoint(touches[0], touches[1]);
            const delta = (currentDist - this.lastPinchDist) * 0.005;
            this.lastPinchDist = currentDist;
            this.callbacks.onPinchZoom(delta, center);

            // Also pan
            const lastCenter = midpoint(
                this.lastTouches[0],
                this.lastTouches[1],
            );
            this.callbacks.onPanMove({
                x: center.x - lastCenter.x,
                y: center.y - lastCenter.y,
            });
        } else if (touches.length === 1 && this.lastTouches.length === 1) {
            // Single finger pan (only when gesture recognizer routes to viewport)
            this.callbacks.onPanMove({
                x: touches[0].x - this.lastTouches[0].x,
                y: touches[0].y - this.lastTouches[0].y,
            });
        }
        this.lastTouches = [...touches];
    }

    handleTouchEnd(): void {
        this.lastTouches = [];
        this.lastPinchDist = 0;
    }
}
