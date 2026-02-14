import type { Point, ShapeElement, Rect } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_STROKE_STYLE, DEFAULT_FILL_STYLE } from '../constants';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let shapeIdCounter = 0;
function generateShapeId(): string {
    return `shape-${++shapeIdCounter}-${Date.now()}`;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'triangle';

export class ShapeTool extends Tool {
    readonly id = 'shape';
    readonly name = 'Shape';
    state: ToolState = 'idle';

    private startPos: Point | null = null;
    private currentPageId = '';
    private createdBy = '';
    private shapeType: ShapeType = 'rectangle';

    setShapeType(type: ShapeType): void {
        this.shapeType = type;
    }

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    onPointerDown(event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'active';
        this.startPos = event.position;
        return { cursor: 'crosshair', state: this.state };
    }

    onPointerMove(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            return { cursor: 'crosshair', state: this.state };
        }

        const shape = this.buildShape(
            this.startPos,
            event.position,
            event.modifiers.shift,
        );

        return {
            preview: [shape],
            cursor: 'crosshair',
            state: this.state,
        };
    }

    onPointerUp(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }

        this.state = 'idle';
        const elementId = generateShapeId();
        const shape = this.buildShape(
            this.startPos,
            event.position,
            event.modifiers.shift,
        );
        shape.id = elementId;

        const mutations = [
            {
                type: 'create' as const,
                elementId,
                pageId: this.currentPageId,
                data: shape,
                timestamp: Date.now(),
            },
        ];

        this.startPos = null;
        return { mutations, state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.startPos = null;
        return { state: 'idle' };
    }

    private buildShape(
        start: Point,
        end: Point,
        constrain: boolean,
    ): ShapeElement {
        let width = end.x - start.x;
        let height = end.y - start.y;

        if (constrain) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * size;
            height = Math.sign(height) * size;
        }

        const x = width >= 0 ? start.x : start.x + width;
        const y = height >= 0 ? start.y : start.y + height;
        const absW = Math.abs(width);
        const absH = Math.abs(height);
        const now = new Date().toISOString();

        const bounds: Rect = { x, y, width: absW, height: absH };

        return {
            id: '__preview_shape__',
            pageId: this.currentPageId,
            type: 'shape',
            zIndex: 999999,
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                shapeType: this.shapeType,
                position: { x, y },
                size: { width: absW, height: absH },
                rotation: 0,
                style: {
                    stroke: { ...DEFAULT_STROKE_STYLE },
                    fill: { ...DEFAULT_FILL_STYLE },
                },
                bounds,
            },
        };
    }
}
