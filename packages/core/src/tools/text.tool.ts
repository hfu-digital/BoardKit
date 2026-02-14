import type { Point, TextElement } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { pointInBounds, calculateBounds } from '../scene/bounds';
import { DEFAULT_TEXT_STYLE } from '../constants';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let textIdCounter = 0;
function generateTextId(): string {
    return `text-${++textIdCounter}-${Date.now()}`;
}

export interface TextToolEvent {
    type: 'createTextEditor' | 'editTextEditor';
    elementId: string;
    position: Point;
}

export class TextTool extends Tool {
    readonly id = 'text';
    readonly name = 'Text';
    state: ToolState = 'idle';

    private currentPageId = '';
    private createdBy = '';

    /** Callback to notify the frontend about text editing */
    onTextEvent?: (event: TextToolEvent) => void;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        // Check if clicking on existing text element
        const hitId = this.hitTestText(event.position, scene);

        if (hitId) {
            this.onTextEvent?.({
                type: 'editTextEditor',
                elementId: hitId,
                position: event.position,
            });
            return { cursor: 'text', state: 'idle' };
        }

        // Create new text element
        const elementId = generateTextId();
        const now = new Date().toISOString();

        const textElement: TextElement = {
            id: elementId,
            pageId: this.currentPageId,
            type: 'text',
            zIndex: Date.now(),
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                content: '',
                position: event.position,
                size: { width: 200, height: 40 },
                rotation: 0,
                style: { ...DEFAULT_TEXT_STYLE },
                bounds: {
                    x: event.position.x,
                    y: event.position.y,
                    width: 200,
                    height: 40,
                },
            },
        };

        const mutations = [
            {
                type: 'create' as const,
                elementId,
                pageId: this.currentPageId,
                data: textElement,
                timestamp: Date.now(),
            },
        ];

        this.onTextEvent?.({
            type: 'createTextEditor',
            elementId,
            position: event.position,
        });

        return { mutations, cursor: 'text', state: 'idle' };
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
