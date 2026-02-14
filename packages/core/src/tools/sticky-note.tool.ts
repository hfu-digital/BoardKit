import type { StickyNoteElement } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_TEXT_STYLE } from '../constants';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let stickyNoteIdCounter = 0;
function generateStickyNoteId(): string {
    return `stickyNote-${++stickyNoteIdCounter}-${Date.now()}`;
}

const DEFAULT_STICKY_NOTE_SIZE = { width: 200, height: 200 };
const DEFAULT_STICKY_NOTE_COLOR = '#FFEAA7';

export class StickyNoteTool extends Tool {
    readonly id = 'stickyNote';
    readonly name = 'Sticky Note';
    state: ToolState = 'idle';

    private currentPageId = '';
    private createdBy = '';
    private color = DEFAULT_STICKY_NOTE_COLOR;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    setColor(color: string): void {
        this.color = color;
    }

    onPointerDown(event: InputEvent, _scene: SceneState): ToolResult {
        const elementId = generateStickyNoteId();
        const now = new Date().toISOString();
        const size = { ...DEFAULT_STICKY_NOTE_SIZE };

        const stickyNoteElement: StickyNoteElement = {
            id: elementId,
            pageId: this.currentPageId,
            type: 'stickyNote',
            zIndex: Date.now(),
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                content: '',
                position: event.position,
                size,
                color: this.color,
                style: { ...DEFAULT_TEXT_STYLE },
                bounds: {
                    x: event.position.x,
                    y: event.position.y,
                    width: size.width,
                    height: size.height,
                },
            },
        };

        const mutations = [
            {
                type: 'create' as const,
                elementId,
                pageId: this.currentPageId,
                data: stickyNoteElement,
                timestamp: Date.now(),
            },
        ];

        return { mutations, cursor: 'default', state: 'idle' };
    }

    onPointerMove(_event: InputEvent, _scene: SceneState): ToolResult {
        return { cursor: 'default', state: this.state };
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        return { cursor: 'default', state: this.state };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        return { state: 'idle' };
    }
}
