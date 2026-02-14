import type { Point, StrokeElement, Rect } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_STROKE_STYLE } from '../constants';
import { smoothPoints } from '../drawing/smoothing';
import { simplifyPoints } from '../drawing/simplify';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let penIdCounter = 0;
function generatePenId(): string {
    return `stroke-${++penIdCounter}-${Date.now()}`;
}

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

export class PenTool extends Tool {
    readonly id = 'pen';
    readonly name = 'Pen';
    state: ToolState = 'idle';

    private points: Point[] = [];
    private pressures: number[] = [];
    private currentPageId = '';
    private createdBy = '';

    onPointerDown(event: InputEvent, _scene: SceneState): ToolResult {
        this.state = 'active';
        this.points = [event.position];
        this.pressures = [event.pressure ?? 0.5];
        return {
            cursor: 'crosshair',
            state: this.state,
        };
    }

    onPointerMove(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active') {
            return { cursor: 'crosshair', state: this.state };
        }

        this.points.push(event.position);
        this.pressures.push(event.pressure ?? 0.5);

        const now = new Date().toISOString();
        const preview: StrokeElement = {
            id: '__preview_stroke__',
            pageId: this.currentPageId,
            type: 'stroke',
            zIndex: 999999,
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                points: this.points,
                pressures: this.pressures,
                style: { ...DEFAULT_STROKE_STYLE },
                bounds: computeBounds(this.points),
            },
        };

        return {
            preview: [preview],
            cursor: 'crosshair',
            state: this.state,
        };
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active') {
            return { state: 'idle' };
        }

        this.state = 'idle';

        if (this.points.length < 2) {
            this.points = [];
            this.pressures = [];
            return { state: 'idle' };
        }

        // Smooth and simplify
        const smoothed = smoothPoints(this.points);
        const simplified = simplifyPoints(smoothed, 1.0);
        const bounds = computeBounds(simplified);
        const now = new Date().toISOString();
        const elementId = generatePenId();

        const mutations = [
            {
                type: 'create' as const,
                elementId,
                pageId: this.currentPageId,
                data: {
                    id: elementId,
                    pageId: this.currentPageId,
                    type: 'stroke' as const,
                    zIndex: Date.now(),
                    createdBy: this.createdBy,
                    createdAt: now,
                    updatedAt: now,
                    data: {
                        points: simplified,
                        pressures: this.pressures,
                        style: { ...DEFAULT_STROKE_STYLE },
                        bounds,
                    },
                },
                timestamp: Date.now(),
            },
        ];

        this.points = [];
        this.pressures = [];

        return { mutations, state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.points = [];
        this.pressures = [];
        return { state: 'idle' };
    }

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }
}
