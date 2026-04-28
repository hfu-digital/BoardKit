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

/**
 * Visual hint emitted by LinearTool while the user is dragging the arrow/line
 * tool over a candidate target shape. The interactive layer paints the
 * shape's perimeter outline plus a small dot at `anchorPoint` so the user
 * sees where the endpoint will attach if they release here.
 */
export interface BindingPreview {
    candidateShapeId: string;
    anchorPoint: Point;
    endpointKind: 'start' | 'end';
}

export interface ToolResult {
    mutations?: ElementMutation[];
    preview?: Element[];
    cursor?: string;
    state: ToolState;
    /** SelectTool emits this on every pointerdown / rubber-band move. BoardCanvas applies it via store.setSelection. */
    selection?: Set<string>;
    /** Live rubber-band rect for visual feedback during drag. BoardCanvas pushes it into the interactive layer's `selections` channel. */
    selectionRect?: Rect;
    /** LinearTool emits these while dragging near a shape. BoardCanvas forwards them to the interactive layer. */
    bindingPreview?: BindingPreview[];
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
