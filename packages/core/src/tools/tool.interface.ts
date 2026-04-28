import type { Point, Rect } from '../types/elements';
import type { ElementMutation } from '../types/events';
import type { Element } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';

export interface InputEvent {
    type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel';
    position: Point;
    pressure?: number;
    tilt?: { x: number; y: number };
    button: number;
    modifiers: {
        shift: boolean;
        ctrl: boolean;
        alt: boolean;
        meta: boolean;
    };
    timestamp: number;
}

export type ToolState = 'idle' | 'active' | 'finishing';

export interface ToolResult {
    mutations?: ElementMutation[];
    preview?: Element[];
    cursor?: string;
    state: ToolState;
    /** SelectTool emits this on every pointerdown / rubber-band move. BoardCanvas applies it via store.setSelection. */
    selection?: Set<string>;
    /** Live rubber-band rect for visual feedback during drag. BoardCanvas pushes it into the interactive layer's `selections` channel. */
    selectionRect?: Rect;
}

export abstract class Tool {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract state: ToolState;

    abstract onPointerDown(
        event: InputEvent,
        scene: SceneState,
    ): ToolResult;
    abstract onPointerMove(
        event: InputEvent,
        scene: SceneState,
    ): ToolResult;
    abstract onPointerUp(
        event: InputEvent,
        scene: SceneState,
    ): ToolResult;
    abstract onCancel(): ToolResult;
}
