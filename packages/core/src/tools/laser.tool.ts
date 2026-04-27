import type { Point, StrokeElement, Rect } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

function computeBounds(points: Point[]): Rect {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export class LaserTool extends Tool {
    readonly id = 'laser';
    readonly name = 'Laser Pointer';
    state: ToolState = 'idle';

    private points: Point[] = [];
    private mode: 'laser' | 'highlighter' = 'laser';

    setMode(mode: 'laser' | 'highlighter'): void {
        this.mode = mode;
    }

    onPointerDown(event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'active';
        this.points = [event.position];
        return this.buildPreview();
    }

    onPointerMove(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active') {
            return { cursor: 'crosshair', state: this.state };
        }
        this.points.push(event.position);
        return this.buildPreview();
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'idle';
        // Return the final preview that the frontend will fade out
        const result = this.buildPreview();
        this.points = [];
        return { ...result, state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.points = [];
        return { state: 'idle' };
    }

    /**
     * Build a preview stroke that won't be persisted.
     * The laser tool NEVER returns mutations -- it only returns previews.
     * The frontend is responsible for fading them out.
     */
    private buildPreview(): ToolResult {
        if (this.points.length < 2) {
            return { cursor: 'crosshair', state: this.state };
        }

        const now = new Date().toISOString();
        const color = this.mode === 'laser' ? '#FF0000' : '#FFFF00';
        const opacity = this.mode === 'laser' ? 1 : 0.3;
        const width = this.mode === 'laser' ? 3 : 20;

        // Create a stroke preview element (not persisted -- no mutations returned)
        const preview: StrokeElement = {
            id: '__laser_preview__',
            pageId: '',
            type: 'stroke',
            zIndex: 999999,
            createdBy: '',
            createdAt: now,
            updatedAt: now,
            data: {
                points: this.points,
                style: {
                    color,
                    width,
                    opacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                    pattern: 'solid',
                },
                bounds: computeBounds(this.points),
            },
        };

        return { preview: [preview], cursor: 'crosshair', state: this.state };
    }
}
