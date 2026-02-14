import type { Point } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { pointInBounds, calculateBounds } from '../scene/bounds';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

export class EraserTool extends Tool {
    readonly id = 'eraser';
    readonly name = 'Eraser';
    state: ToolState = 'idle';

    private erasedIds = new Set<string>();
    private currentPageId = '';

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        this.state = 'active';
        this.erasedIds.clear();
        return this.eraseAt(event.position, scene);
    }

    onPointerMove(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active') {
            return { cursor: 'crosshair', state: this.state };
        }
        return this.eraseAt(event.position, scene);
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'idle';

        if (this.erasedIds.size === 0) {
            return { state: 'idle' };
        }

        const mutations = Array.from(this.erasedIds).map((elementId) => ({
            type: 'delete' as const,
            elementId,
            pageId: this.currentPageId,
            timestamp: Date.now(),
        }));

        this.erasedIds.clear();
        return { mutations, state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.erasedIds.clear();
        return { state: 'idle' };
    }

    private eraseAt(position: Point, scene: SceneState): ToolResult {
        for (const [id, el] of scene.elements) {
            if (
                el.pageId === this.currentPageId &&
                !this.erasedIds.has(id)
            ) {
                const bounds = calculateBounds(el);
                if (pointInBounds(position, bounds)) {
                    this.erasedIds.add(id);
                }
            }
        }

        return { cursor: 'crosshair', state: this.state };
    }
}
