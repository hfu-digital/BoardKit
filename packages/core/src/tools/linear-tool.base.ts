import type { Point, LinearElement, Rect } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_STROKE_STYLE, generateRoughSeed } from '../constants';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let linearIdCounter = 0;
function generateLinearId(): string {
    return `linear-${++linearIdCounter}-${Date.now()}`;
}

/**
 * Shared two-point drag behavior for Line and Arrow tools. Subclasses set
 * `linearType` and `arrowEnd` (Arrow gets a head, Line doesn't). Holding
 * shift snaps the end angle to multiples of 15° for clean axis-aligned lines.
 */
export abstract class LinearTool extends Tool {
    abstract readonly linearType: 'line' | 'arrow';
    abstract readonly arrowEnd: boolean;
    state: ToolState = 'idle';

    private startPos: Point | null = null;
    private currentPageId = '';
    private createdBy = '';

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
        const linear = this.buildLinear(this.startPos, event.position, event.modifiers.shift);
        return { preview: [linear], cursor: 'crosshair', state: this.state };
    }

    onPointerUp(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }
        this.state = 'idle';
        const elementId = generateLinearId();
        const linear = this.buildLinear(this.startPos, event.position, event.modifiers.shift);
        linear.id = elementId;

        // Drop zero-length lines (a single click).
        const dx = linear.data.points[1].x - linear.data.points[0].x;
        const dy = linear.data.points[1].y - linear.data.points[0].y;
        if (Math.hypot(dx, dy) < 2) {
            this.startPos = null;
            return { state: 'idle' };
        }

        const mutations = [
            {
                type: 'create' as const,
                elementId,
                pageId: this.currentPageId,
                data: linear,
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

    private buildLinear(start: Point, end: Point, constrain: boolean): LinearElement {
        let actualEnd = end;
        if (constrain) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const angle = Math.atan2(dy, dx);
            const len = Math.hypot(dx, dy);
            const snap = Math.PI / 12; // 15° increments
            const snapped = Math.round(angle / snap) * snap;
            actualEnd = {
                x: start.x + Math.cos(snapped) * len,
                y: start.y + Math.sin(snapped) * len,
            };
        }

        const minX = Math.min(start.x, actualEnd.x);
        const minY = Math.min(start.y, actualEnd.y);
        const maxX = Math.max(start.x, actualEnd.x);
        const maxY = Math.max(start.y, actualEnd.y);
        const bounds: Rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const now = new Date().toISOString();

        return {
            id: '__preview_linear__',
            pageId: this.currentPageId,
            type: 'linear',
            zIndex: 999999,
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                linearType: this.linearType,
                points: [start, actualEnd],
                rotation: 0,
                style: { ...DEFAULT_STROKE_STYLE },
                roughness: 1,
                seed: generateRoughSeed(),
                arrowStart: false,
                arrowEnd: this.arrowEnd,
                bounds,
            },
        };
    }
}
