import type { Point, Rect, Element } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { pointInBounds, boundsIntersect, calculateBounds } from '../scene/bounds';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

type SelectMode = 'none' | 'drag' | 'rubberBand';

export class SelectTool extends Tool {
    readonly id = 'select';
    readonly name = 'Select';
    state: ToolState = 'idle';

    private mode: SelectMode = 'none';
    private startPos: Point | null = null;
    private lastPos: Point | null = null;
    private selectedIds = new Set<string>();
    private dragOffsets = new Map<string, Point>();
    private currentPageId = '';

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    getSelectedIds(): Set<string> {
        return new Set(this.selectedIds);
    }

    setSelectedIds(ids: Set<string>): void {
        this.selectedIds = new Set(ids);
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        this.startPos = event.position;
        this.lastPos = event.position;

        // Check if clicking on an existing element
        const hitId = this.hitTest(event.position, scene);

        if (hitId) {
            // If shift is held, toggle selection
            if (event.modifiers.shift) {
                if (this.selectedIds.has(hitId)) {
                    this.selectedIds.delete(hitId);
                } else {
                    this.selectedIds.add(hitId);
                }
            } else if (!this.selectedIds.has(hitId)) {
                this.selectedIds = new Set([hitId]);
            }

            // Start drag
            this.mode = 'drag';
            this.state = 'active';

            // Record offsets
            this.dragOffsets.clear();
            for (const id of this.selectedIds) {
                const el = scene.elements.get(id);
                if (el) {
                    const bounds = calculateBounds(el);
                    this.dragOffsets.set(id, {
                        x: event.position.x - bounds.x,
                        y: event.position.y - bounds.y,
                    });
                }
            }

            return { cursor: 'move', state: this.state };
        }

        // Start rubber-band selection
        if (!event.modifiers.shift) {
            this.selectedIds.clear();
        }
        this.mode = 'rubberBand';
        this.state = 'active';
        return { cursor: 'crosshair', state: this.state };
    }

    onPointerMove(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            return { cursor: 'default', state: this.state };
        }

        this.lastPos = event.position;

        if (this.mode === 'drag') {
            // Generate move mutations as preview
            const delta: Point = {
                x: event.position.x - this.startPos.x,
                y: event.position.y - this.startPos.y,
            };

            const preview: Element[] = [];
            for (const id of this.selectedIds) {
                const el = scene.elements.get(id);
                if (el) {
                    const bounds = calculateBounds(el);
                    preview.push({
                        ...el,
                        data: {
                            ...el.data,
                            bounds: {
                                ...bounds,
                                x: bounds.x + delta.x,
                                y: bounds.y + delta.y,
                            },
                        },
                    } as Element);
                }
            }

            return { preview, cursor: 'move', state: this.state };
        }

        if (this.mode === 'rubberBand') {
            // Update rubber-band selection
            const rect = this.getRubberBandRect();
            if (rect) {
                // Find elements intersecting the rect
                for (const [id, el] of scene.elements) {
                    if (el.pageId === this.currentPageId) {
                        const bounds = calculateBounds(el);
                        if (boundsIntersect(rect, bounds)) {
                            this.selectedIds.add(id);
                        }
                    }
                }
            }
            return { cursor: 'crosshair', state: this.state };
        }

        return { cursor: 'default', state: this.state };
    }

    onPointerUp(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }

        this.state = 'idle';

        if (this.mode === 'drag') {
            const delta: Point = {
                x: event.position.x - this.startPos.x,
                y: event.position.y - this.startPos.y,
            };

            // Only create mutations if actually moved
            if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) {
                const mutations = Array.from(this.selectedIds).map(
                    (elementId) => ({
                        type: 'update' as const,
                        elementId,
                        pageId: this.currentPageId,
                        data: { _moveDelta: delta } as unknown as Partial<Element>,
                        timestamp: Date.now(),
                    }),
                );
                this.mode = 'none';
                this.startPos = null;
                this.lastPos = null;
                return { mutations, state: 'idle' };
            }
        }

        this.mode = 'none';
        this.startPos = null;
        this.lastPos = null;
        return { state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.mode = 'none';
        this.startPos = null;
        this.lastPos = null;
        return { state: 'idle' };
    }

    private hitTest(position: Point, scene: SceneState): string | null {
        // Iterate in reverse z-order (top elements first)
        for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
            const id = scene.elementOrder[i];
            const el = scene.elements.get(id);
            if (el && el.pageId === this.currentPageId) {
                const bounds = calculateBounds(el);
                if (pointInBounds(position, bounds)) {
                    return id;
                }
            }
        }
        return null;
    }

    private getRubberBandRect(): Rect | null {
        if (!this.startPos || !this.lastPos) return null;
        const x = Math.min(this.startPos.x, this.lastPos.x);
        const y = Math.min(this.startPos.y, this.lastPos.y);
        const width = Math.abs(this.lastPos.x - this.startPos.x);
        const height = Math.abs(this.lastPos.y - this.startPos.y);
        return { x, y, width, height };
    }
}
