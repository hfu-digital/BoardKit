import type { Point } from '@boardkit/core';

export type GestureTarget = 'tool' | 'viewport';
export type GestureType = 'draw' | 'pan' | 'zoom' | 'secondary';

export interface GestureState {
    active: boolean;
    target: GestureTarget;
    type: GestureType;
    startPosition: Point | null;
    touchCount: number;
    pinchDistance: number | null;
}

export class GestureRecognizer {
    private state: GestureState = {
        active: false,
        target: 'tool',
        type: 'draw',
        startPosition: null,
        touchCount: 0,
        pinchDistance: null,
    };

    private isSpaceDown = false;

    setSpaceDown(down: boolean): void {
        this.isSpaceDown = down;
    }

    /**
     * Determines where a pointer event should be routed.
     */
    classifyPointerDown(
        button: number,
        pointerType: string,
        touchCount: number,
    ): GestureTarget {
        // Middle mouse button = always pan
        if (button === 1) {
            this.state.target = 'viewport';
            this.state.type = 'pan';
            return 'viewport';
        }

        // Space + left click = pan
        if (this.isSpaceDown && button === 0) {
            this.state.target = 'viewport';
            this.state.type = 'pan';
            return 'viewport';
        }

        // Two finger touch = pan/zoom
        if (pointerType === 'touch' && touchCount >= 2) {
            this.state.target = 'viewport';
            this.state.type = 'zoom';
            return 'viewport';
        }

        // Pen barrel button = secondary action
        if (pointerType === 'pen' && button === 5) {
            this.state.target = 'tool';
            this.state.type = 'secondary';
            return 'tool';
        }

        // Default: route to tool
        this.state.target = 'tool';
        this.state.type = 'draw';
        return 'tool';
    }

    classifyWheel(): GestureTarget {
        return 'viewport';
    }

    getState(): GestureState {
        return { ...this.state };
    }

    reset(): void {
        this.state = {
            active: false,
            target: 'tool',
            type: 'draw',
            startPosition: null,
            touchCount: 0,
            pinchDistance: null,
        };
    }
}
