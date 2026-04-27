import type { Point, ShapeElement, Rect } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_SHAPE_STYLE, generateRoughSeed } from '../constants';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let shapeIdCounter = 0;
function generateShapeId(): string {
    return `shape-${++shapeIdCounter}-${Date.now()}`;
}

/**
 * Shared drag-to-create rectangle/diamond/ellipse behavior. Each concrete
 * subclass picks its `shapeType` so the tool registry has distinct ids
 * and the toolbar can show distinct icons. Behavior is identical:
 * - Pointer down captures origin
 * - Pointer move previews the shape with the current bounding box
 * - Holding shift constrains to a square (1:1 aspect ratio)
 * - Pointer up emits a `create` mutation with a fresh seed for Rough.js
 */
export abstract class RectShapeTool extends Tool {
    abstract readonly shapeType: 'rectangle' | 'diamond' | 'ellipse';
    state: ToolState = 'idle';

    private startPos: Point | null = null;
    private currentPageId = '';
    private createdBy = '';
    /**
     * Seed captured once at pointer-down so the Rough.js wobble stays stable
     * during the drag preview and matches the persisted shape on pointer-up.
     * Without this, every onPointerMove regenerates a seed and the preview
     * flickers between random sketches.
     */
    private currentSeed = 1;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    onPointerDown(event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'active';
        this.startPos = event.position;
        this.currentSeed = generateRoughSeed();
        return { cursor: 'crosshair', state: this.state };
    }

    onPointerMove(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            return { cursor: 'crosshair', state: this.state };
        }
        const shape = this.buildShape(this.startPos, event.position, event.modifiers.shift);
        return { preview: [shape], cursor: 'crosshair', state: this.state };
    }

    onPointerUp(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }
        this.state = 'idle';
        const elementId = generateShapeId();
        const shape = this.buildShape(this.startPos, event.position, event.modifiers.shift);
        shape.id = elementId;

        // Drop zero-size shapes (a single click without drag).
        if (shape.data.size.width < 1 && shape.data.size.height < 1) {
            this.startPos = null;
            return { state: 'idle' };
        }

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

    private buildShape(start: Point, end: Point, constrain: boolean): ShapeElement {
        let width = end.x - start.x;
        let height = end.y - start.y;
        if (constrain) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = (Math.sign(width) || 1) * size;
            height = (Math.sign(height) || 1) * size;
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
                style: { ...DEFAULT_SHAPE_STYLE, seed: this.currentSeed },
                bounds,
            },
        };
    }
}
