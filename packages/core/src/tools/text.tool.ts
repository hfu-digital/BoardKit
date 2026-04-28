import type { Point } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { pointInBounds, calculateBounds } from '../scene/bounds';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

/**
 * The TextTool is a pure intent emitter. It never persists anything itself —
 * element creation/update lives in the React layer's `useTextEditor` hook,
 * which subscribes to `onTextEvent`. On click, the tool either signals
 * "edit this existing text element" (if the click hit one) or "open a fresh
 * text editor at this position" (if it didn't). The hook decides whether
 * an empty commit produces no element (create) or deletes the element (edit).
 */
export type TextToolEvent =
    | { type: 'createTextEditor'; position: Point }
    | { type: 'editTextEditor'; elementId: string; position: Point };

export class TextTool extends Tool {
    readonly id = 'text';
    readonly name = 'Text';
    state: ToolState = 'idle';

    private currentPageId = '';

    /** Callback wired by the React layer to drive the inline TextEditor. */
    onTextEvent?: (event: TextToolEvent) => void;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        const hitId = this.hitTestText(event.position, scene);
        if (hitId) {
            this.onTextEvent?.({
                type: 'editTextEditor',
                elementId: hitId,
                position: event.position,
            });
        } else {
            this.onTextEvent?.({
                type: 'createTextEditor',
                position: event.position,
            });
        }
        return { cursor: 'text', state: 'idle' };
    }

    onPointerMove(_event: InputEvent, _scene: SceneState): ToolResult {
        return { cursor: 'text', state: this.state };
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        return { cursor: 'text', state: this.state };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        return { state: 'idle' };
    }

    private hitTestText(position: Point, scene: SceneState): string | null {
        for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
            const id = scene.elementOrder[i];
            const el = scene.elements.get(id);
            if (
                el &&
                el.pageId === this.currentPageId &&
                el.type === 'text'
            ) {
                const bounds = calculateBounds(el);
                if (pointInBounds(position, bounds)) {
                    return id;
                }
            }
        }
        return null;
    }
}
