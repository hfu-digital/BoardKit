import type {
    EndpointBinding,
    LinearElement,
    Point,
    Rect,
    ShapeElement,
} from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_STROKE_STYLE, generateRoughSeed } from '../constants';
import { expandBounds, pointInBounds } from '../scene/bounds';
import {
    distanceToShapePerimeter,
    intersectShapePerimeter,
} from '../geometry/perimeter';
import { resolveLinearEndpoints } from '../operations/resolve-bindings';
import {
    Tool,
    type BindingPreview,
    type InputEvent,
    type ToolResult,
    type ToolState,
} from './tool.interface';

let linearIdCounter = 0;
function generateLinearId(): string {
    return `linear-${++linearIdCounter}-${Date.now()}`;
}

/**
 * Distance (in world units) at which the cursor is considered "near enough"
 * to a shape's perimeter to bind to it. Inside the shape always counts as
 * binding (distance = 0). Lives in world space because tools currently
 * don't see the viewport zoom — at extreme zoom-out the effective hit area
 * shrinks; threading viewport zoom into InputEvent would be the fix.
 */
export const BIND_PROXIMITY_PX = 12;

/**
 * Shared two-point drag behavior for Line and Arrow tools. Subclasses set
 * `linearType` and `arrowEnd` (Arrow gets a head, Line doesn't). Holding
 * shift snaps the end angle to multiples of 15° for clean axis-aligned lines.
 *
 * Both endpoints can optionally bind to a `shape` element — when bound, the
 * stored `points[i]` is the perimeter intersection (so the element renders
 * correctly without re-resolution), and on later moves of the bound shape
 * the endpoint follows automatically (see `operations/resolve-bindings.ts`
 * and the SelectTool propagation logic).
 */
export abstract class LinearTool extends Tool {
    abstract readonly linearType: 'line' | 'arrow';
    abstract readonly arrowEnd: boolean;
    state: ToolState = 'idle';

    private startPos: Point | null = null;
    private currentPageId = '';
    private createdBy = '';
    /** Captured at pointer-down so the Rough.js wobble stays stable across the drag. */
    private currentSeed = 1;
    /** Captured at pointer-down if the click was on/near a shape. */
    private startBinding: EndpointBinding | null = null;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        this.state = 'active';
        this.startPos = event.position;
        this.currentSeed = generateRoughSeed();
        const startShape = findCandidateShape(scene, event.position, this.currentPageId);
        this.startBinding = startShape ? { elementId: startShape.id } : null;
        return { cursor: 'crosshair', state: this.state };
    }

    onPointerMove(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            // Hover phase (tool active but no drag yet): still highlight a
            // nearby shape's perimeter + anchor dot so the user discovers
            // they can connect. No line preview because there's nothing to
            // draw without a start point.
            const hoverShape = findCandidateShape(
                scene,
                event.position,
                this.currentPageId,
            );
            if (hoverShape) {
                return {
                    cursor: 'crosshair',
                    state: this.state,
                    bindingPreview: [
                        {
                            candidateShapeId: hoverShape.id,
                            anchorPoint: intersectShapePerimeter(
                                hoverShape,
                                event.position,
                            ),
                            endpointKind: 'end',
                        },
                    ],
                };
            }
            return { cursor: 'crosshair', state: this.state };
        }
        const endShape = findCandidateShape(scene, event.position, this.currentPageId);
        const endBinding: EndpointBinding | null = endShape
            ? { elementId: endShape.id }
            : null;

        const linear = this.buildLinear(
            this.startPos,
            event.position,
            event.modifiers.shift,
            this.startBinding,
            endBinding,
        );
        applyResolvedEndpoints(linear, scene);

        const bindingPreview = buildBindingPreviews(
            scene,
            linear,
            this.startBinding,
            endBinding,
        );

        return {
            preview: [linear],
            bindingPreview,
            cursor: 'crosshair',
            state: this.state,
        };
    }

    onPointerUp(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPos) {
            this.state = 'idle';
            return { state: 'idle' };
        }
        this.state = 'idle';
        const endShape = findCandidateShape(scene, event.position, this.currentPageId);
        const endBinding: EndpointBinding | null = endShape
            ? { elementId: endShape.id }
            : null;

        const elementId = generateLinearId();
        const linear = this.buildLinear(
            this.startPos,
            event.position,
            event.modifiers.shift,
            this.startBinding,
            endBinding,
        );
        linear.id = elementId;
        applyResolvedEndpoints(linear, scene);

        // Drop zero-length lines (a single click). Compare resolved points
        // so a bound-to-bound click doesn't pass the threshold spuriously.
        const start = linear.data.points[0];
        const end = linear.data.points[1];
        if (Math.hypot(end.x - start.x, end.y - start.y) < 2) {
            this.resetTransientState();
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
        this.resetTransientState();
        return { mutations, state: 'idle' };
    }

    onCancel(): ToolResult {
        this.state = 'idle';
        this.resetTransientState();
        return { state: 'idle' };
    }

    private resetTransientState(): void {
        this.startPos = null;
        this.startBinding = null;
    }

    private buildLinear(
        start: Point,
        end: Point,
        constrain: boolean,
        startBinding: EndpointBinding | null,
        endBinding: EndpointBinding | null,
    ): LinearElement {
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
                seed: this.currentSeed,
                arrowStart: false,
                arrowEnd: this.arrowEnd,
                bounds,
                ...(startBinding ? { startBinding } : {}),
                ...(endBinding ? { endBinding } : {}),
            },
        };
    }
}

/**
 * Find the topmost shape on the given page within `BIND_PROXIMITY_PX` of
 * `position` (or that contains the position). Cheap-rejects via expanded
 * AABB before doing the per-shape-type perimeter distance.
 */
function findCandidateShape(
    scene: SceneState,
    position: Point,
    pageId: string,
): ShapeElement | null {
    let bestShape: ShapeElement | null = null;
    let bestDistance = Infinity;
    for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
        const id = scene.elementOrder[i];
        const el = scene.elements.get(id);
        if (!el || el.pageId !== pageId || el.type !== 'shape') continue;
        const inflated = expandBounds(el.data.bounds, BIND_PROXIMITY_PX);
        if (!pointInBounds(position, inflated)) continue;
        const d = distanceToShapePerimeter(el, position);
        if (d <= BIND_PROXIMITY_PX && d < bestDistance) {
            bestShape = el;
            bestDistance = d;
            // Topmost match wins on ties; iteration is reverse-z-order so we
            // can break as soon as we have a fully-inside (distance 0) hit.
            if (d === 0) break;
        }
    }
    return bestShape;
}

/**
 * Mutate `linear.data.points` and `linear.data.bounds` so the rendered
 * geometry reflects bindings. Used both for live preview during drag and
 * for the create-mutation payload at pointer-up — that way the persisted
 * element is self-consistent without relying on consumers to re-resolve.
 */
function applyResolvedEndpoints(
    linear: LinearElement,
    scene: SceneState,
): void {
    const [start, end] = resolveLinearEndpoints(linear, scene);
    linear.data.points = [start, end];
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    linear.data.bounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function buildBindingPreviews(
    scene: SceneState,
    linear: LinearElement,
    startBinding: EndpointBinding | null,
    endBinding: EndpointBinding | null,
): BindingPreview[] {
    const previews: BindingPreview[] = [];
    if (startBinding) {
        const shape = scene.elements.get(startBinding.elementId);
        if (shape && shape.type === 'shape') {
            // Anchor point for the start: where points[0] now lives after
            // resolution. We could recompute from intersectShapePerimeter,
            // but applyResolvedEndpoints already did the work.
            previews.push({
                candidateShapeId: startBinding.elementId,
                anchorPoint: linear.data.points[0],
                endpointKind: 'start',
            });
        }
    }
    if (endBinding) {
        const shape = scene.elements.get(endBinding.elementId);
        if (shape && shape.type === 'shape') {
            previews.push({
                candidateShapeId: endBinding.elementId,
                anchorPoint: linear.data.points[1],
                endpointKind: 'end',
            });
        }
    }
    return previews;
}

// Re-exported so test suites and callers can probe the helper without
// reaching into the file directly. Kept private to the module by default.
export { findCandidateShape };
