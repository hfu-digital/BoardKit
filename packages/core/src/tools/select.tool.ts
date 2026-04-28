import type { Point, Rect, Element, LinearElement } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import {
    boundsIntersect,
    calculateBounds,
    hitTestElement,
    mergeBounds,
    pointInBounds,
} from '../scene/bounds';
import { moveElements, resizeElement } from '../operations/transform';
import {
    getDependentLinears,
    recomputeBoundLinear,
} from '../operations/resolve-bindings';
import {
    applyHandleResize,
    getSelectionHandleRects,
    handleCursor,
    type HandleId,
} from '../scene/handles';
import {
    Tool,
    type InputEvent,
    type ToolResult,
    type ToolState,
} from './tool.interface';

type SelectMode = 'none' | 'drag' | 'rubberBand' | 'resize';

const DRAG_THRESHOLD_PX = 5;

/**
 * Selection / move / resize tool. State (selection ids) lives in the store —
 * BoardCanvas pushes the latest set in via `setCurrentSelection` before each
 * pointer dispatch, and the tool returns the new set on `result.selection`
 * for BoardCanvas to apply via `store.setSelection`.
 *
 * Move and resize operate on a snapshot of the original elements taken on
 * pointerdown (`dragOriginals` / `resizeOriginals`), so the math is stable
 * against intermediate scene mutations.
 */
export class SelectTool extends Tool {
    readonly id = 'select';
    readonly name = 'Select';
    state: ToolState = 'idle';

    private mode: SelectMode = 'none';
    private startPos: Point | null = null;
    private lastPos: Point | null = null;
    private currentPageId = '';

    /** Transient input set by BoardCanvas before each pointer dispatch. */
    private currentSelection = new Set<string>();
    private currentZoom = 1;

    // Drag (move) state
    private dragOriginals: Element[] = [];
    private dragArmed = false;

    // Resize state
    private resizeHandle: HandleId | null = null;
    private resizeOriginalBounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
    private resizeOriginals: Element[] = [];

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCurrentSelection(ids: Set<string>): void {
        this.currentSelection = new Set(ids);
    }

    setViewportZoom(zoom: number): void {
        this.currentZoom = zoom;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        this.startPos = event.position;
        this.lastPos = event.position;
        this.dragArmed = false;

        // 1) Resize handle hit-test runs first — only when something is selected.
        if (this.currentSelection.size > 0) {
            const merged = this.mergedSelectionBounds(scene);
            if (merged) {
                const handles = getSelectionHandleRects(merged, this.currentZoom);
                for (const handle of Object.keys(handles) as HandleId[]) {
                    if (pointInBounds(event.position, handles[handle])) {
                        this.mode = 'resize';
                        this.state = 'active';
                        this.resizeHandle = handle;
                        this.resizeOriginalBounds = merged;
                        this.resizeOriginals = Array.from(this.currentSelection)
                            .map((id) => scene.elements.get(id))
                            .filter((el): el is Element => Boolean(el));
                        return { cursor: handleCursor(handle), state: this.state };
                    }
                }
            }
        }

        // 2) Element hit-test → drag.
        const hitId = this.hitTest(event.position, scene);
        if (hitId) {
            let next: Set<string>;
            if (event.modifiers.shift) {
                next = new Set(this.currentSelection);
                if (next.has(hitId)) next.delete(hitId);
                else next.add(hitId);
            } else if (this.currentSelection.has(hitId)) {
                // Click inside an existing multi-selection keeps it intact.
                next = new Set(this.currentSelection);
            } else {
                next = new Set([hitId]);
            }

            this.mode = 'drag';
            this.state = 'active';
            this.dragOriginals = Array.from(next)
                .map((id) => scene.elements.get(id))
                .filter((el): el is Element => Boolean(el));

            return { cursor: 'move', state: this.state, selection: next };
        }

        // 3) Empty space → start rubber-band. Clear selection unless shift.
        const next = event.modifiers.shift ? new Set(this.currentSelection) : new Set<string>();
        this.mode = 'rubberBand';
        this.state = 'active';
        return { cursor: 'crosshair', state: this.state, selection: next };
    }

    onPointerMove(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            return { cursor: 'default', state: this.state };
        }
        this.lastPos = event.position;

        if (this.mode === 'resize' && this.resizeHandle) {
            const newBounds = applyHandleResize(
                this.resizeHandle,
                this.resizeOriginalBounds,
                event.position,
                { shift: event.modifiers.shift, alt: event.modifiers.alt },
            );
            const resized = this.mapResize(newBounds);
            const preview = this.propagateBindings(scene, resized);
            return { preview, cursor: handleCursor(this.resizeHandle), state: this.state };
        }

        if (this.mode === 'drag') {
            const delta: Point = {
                x: event.position.x - this.startPos.x,
                y: event.position.y - this.startPos.y,
            };
            if (!this.dragArmed && Math.hypot(delta.x, delta.y) >= DRAG_THRESHOLD_PX) {
                this.dragArmed = true;
            }
            if (!this.dragArmed) {
                return { cursor: 'move', state: this.state };
            }
            const moved = moveElements(this.dragOriginals, delta);
            const preview = this.propagateBindings(scene, moved);
            return { preview, cursor: 'move', state: this.state };
        }

        if (this.mode === 'rubberBand') {
            const rect = this.getRubberBandRect();
            const next = new Set<string>();
            if (rect) {
                for (const [id, el] of scene.elements) {
                    if (el.pageId !== this.currentPageId) continue;
                    const bounds = calculateBounds(el);
                    if (boundsIntersect(rect, bounds)) next.add(id);
                }
            }
            return {
                cursor: 'crosshair',
                state: this.state,
                selection: next,
                selectionRect: rect ?? undefined,
            };
        }

        return { cursor: 'default', state: this.state };
    }

    onPointerUp(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }
        this.state = 'idle';

        if (this.mode === 'resize' && this.resizeHandle) {
            const newBounds = applyHandleResize(
                this.resizeHandle,
                this.resizeOriginalBounds,
                event.position,
                { shift: event.modifiers.shift, alt: event.modifiers.alt },
            );
            const resized = this.mapResize(newBounds);
            const all = this.propagateBindings(scene, resized);
            const mutations = all.map((el) => ({
                type: 'update' as const,
                elementId: el.id,
                pageId: this.currentPageId,
                data: { data: el.data, updatedAt: el.updatedAt } as Partial<Element>,
                timestamp: Date.now(),
            }));
            this.resetTransientState();
            return { mutations, state: 'idle' };
        }

        if (this.mode === 'drag' && this.dragArmed) {
            const delta: Point = {
                x: event.position.x - this.startPos.x,
                y: event.position.y - this.startPos.y,
            };
            const moved = moveElements(this.dragOriginals, delta);
            const all = this.propagateBindings(scene, moved);
            const mutations = all.map((el) => ({
                type: 'update' as const,
                elementId: el.id,
                pageId: this.currentPageId,
                data: { data: el.data, updatedAt: el.updatedAt } as Partial<Element>,
                timestamp: Date.now(),
            }));
            this.resetTransientState();
            return { mutations, state: 'idle' };
        }

        // Rubber-band: selection was already pushed live during pointermove;
        // no commit-time work needed.
        this.resetTransientState();
        return { state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.resetTransientState();
        return { state: 'idle' };
    }

    // ------------------------------------------------------------------

    private resetTransientState(): void {
        this.mode = 'none';
        this.startPos = null;
        this.lastPos = null;
        this.dragOriginals = [];
        this.dragArmed = false;
        this.resizeHandle = null;
        this.resizeOriginals = [];
    }

    /**
     * Map the merged-bounds resize onto each original element. Each element's
     * bbox is scaled proportionally against the merged-bounds delta and passed
     * to `resizeElement` from core/operations/transform — that helper handles
     * per-type scaling (position/size for shapes, points for strokes/linears).
     */
    private mapResize(newBounds: Rect): Element[] {
        const orig = this.resizeOriginalBounds;
        const scaleX = orig.width !== 0 ? newBounds.width / orig.width : 1;
        const scaleY = orig.height !== 0 ? newBounds.height / orig.height : 1;
        return this.resizeOriginals.map((el) => {
            const b = calculateBounds(el);
            const mapped: Rect = {
                x: newBounds.x + (b.x - orig.x) * scaleX,
                y: newBounds.y + (b.y - orig.y) * scaleY,
                width: b.width * scaleX,
                height: b.height * scaleY,
            };
            return resizeElement(el, mapped);
        });
    }

    /**
     * Take a first-pass set of moved/resized elements (from `moveElements`
     * or `mapResize`) and append re-resolved versions of any linear elements
     * whose bindings reference a moved shape — including dependents that
     * weren't part of the selection. Linears already in the first pass that
     * carry bindings are themselves re-resolved (their points were blindly
     * translated/scaled, which can leave a bound endpoint off-perimeter).
     *
     * Order matters for resize: we apply the entire first-pass to a transient
     * scene before re-resolving, so an arrow whose source and target are both
     * being resized binds against post-resize neighbours.
     */
    private propagateBindings(scene: SceneState, firstPass: Element[]): Element[] {
        const movedIds = new Set(firstPass.map((el) => el.id));
        const movedShapeIds = new Set(
            firstPass.filter((el) => el.type === 'shape').map((el) => el.id),
        );

        const transientElements = new Map(scene.elements);
        for (const el of firstPass) transientElements.set(el.id, el);
        const transientScene: SceneState = {
            elements: transientElements,
            elementOrder: scene.elementOrder,
        };

        const recomputedFirstPass = firstPass.map((el) => {
            if (el.type !== 'linear') return el;
            const linear = el as LinearElement;
            const hasBinding =
                linear.data.startBinding !== undefined ||
                linear.data.endBinding !== undefined;
            if (!hasBinding) return el;
            return recomputeBoundLinear(linear, transientScene);
        });

        // External dependents: linears in the scene NOT in firstPass that
        // bind to one of the moved shapes.
        const externalDependents = getDependentLinears(transientScene, movedShapeIds)
            .filter((l) => !movedIds.has(l.id))
            .map((l) => recomputeBoundLinear(l, transientScene));

        return [...recomputedFirstPass, ...externalDependents];
    }

    private mergedSelectionBounds(scene: SceneState): Rect | null {
        const els = Array.from(this.currentSelection)
            .map((id) => scene.elements.get(id))
            .filter((el): el is Element => Boolean(el));
        if (els.length === 0) return null;
        return mergeBounds(els.map(calculateBounds));
    }

    private hitTest(position: Point, scene: SceneState): string | null {
        // Tolerance is in world units; scaling by 1/zoom keeps the on-screen
        // forgiveness ~6px regardless of how zoomed-in the canvas is.
        const tolerance = 6 / Math.max(this.currentZoom, 0.0001);
        for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
            const id = scene.elementOrder[i];
            const el = scene.elements.get(id);
            if (el && el.pageId === this.currentPageId) {
                if (hitTestElement(position, el, tolerance, scene)) {
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
