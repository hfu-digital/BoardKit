import type { Element, Point, Rect, ConnectorElement, AnchorPosition } from '../types/elements';
import type { SceneState } from '../scene/scene-graph';
import { DEFAULT_STROKE_STYLE } from '../constants';
import { pointInBounds, calculateBounds } from '../scene/bounds';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

let connectorIdCounter = 0;
function generateConnectorId(): string {
    return `connector-${++connectorIdCounter}-${Date.now()}`;
}

export function getAnchorPosition(bounds: Rect, anchor: AnchorPosition): Point {
    switch (anchor) {
        case 'top':
            return { x: bounds.x + bounds.width / 2, y: bounds.y };
        case 'right':
            return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
        case 'bottom':
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
        case 'left':
            return { x: bounds.x, y: bounds.y + bounds.height / 2 };
        case 'center':
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        default:
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }
}

export function closestAnchor(point: Point, bounds: Rect): AnchorPosition {
    const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
    let minDist = Infinity;
    let best: AnchorPosition = 'top';

    for (const anchor of anchors) {
        const pos = getAnchorPosition(bounds, anchor);
        const dx = point.x - pos.x;
        const dy = point.y - pos.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
            minDist = dist;
            best = anchor;
        }
    }

    return best;
}

function computeConnectorBounds(waypoints: Point[]): Rect {
    if (waypoints.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of waypoints) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export class ConnectorTool extends Tool {
    readonly id = 'connector';
    readonly name = 'Connector';
    state: ToolState = 'idle';

    private currentPageId = '';
    private createdBy = '';

    private startElementId: string | null = null;
    private startAnchor: AnchorPosition = 'center';
    private startPoint: Point | null = null;

    setPageId(pageId: string): void {
        this.currentPageId = pageId;
    }

    setCreatedBy(userId: string): void {
        this.createdBy = userId;
    }

    onPointerDown(event: InputEvent, scene: SceneState): ToolResult {
        // Check if clicking on an element
        const hit = this.hitTestElement(event.position, scene);

        if (hit) {
            this.state = 'active';
            this.startElementId = hit.id;
            const bounds = calculateBounds(hit);
            this.startAnchor = closestAnchor(event.position, bounds);
            this.startPoint = getAnchorPosition(bounds, this.startAnchor);

            return { cursor: 'crosshair', state: this.state };
        }

        // Clicked on empty space, do nothing
        return { cursor: 'crosshair', state: 'idle' };
    }

    onPointerMove(event: InputEvent, _scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startPoint) {
            return { cursor: 'crosshair', state: this.state };
        }

        // Draw a preview line from start to current position
        const now = new Date().toISOString();
        const waypoints = [this.startPoint, event.position];

        const preview: ConnectorElement = {
            id: '__preview_connector__',
            pageId: this.currentPageId,
            type: 'connector',
            zIndex: 999999,
            createdBy: this.createdBy,
            createdAt: now,
            updatedAt: now,
            data: {
                startElementId: this.startElementId ?? '',
                endElementId: '',
                startAnchor: this.startAnchor,
                endAnchor: 'center',
                waypoints,
                style: { ...DEFAULT_STROKE_STYLE },
                arrowStart: false,
                arrowEnd: true,
                bounds: computeConnectorBounds(waypoints),
            },
        };

        return {
            preview: [preview],
            cursor: 'crosshair',
            state: this.state,
        };
    }

    onPointerUp(event: InputEvent, scene: SceneState): ToolResult {
        if (this.state !== 'active' || !this.startElementId || !this.startPoint) {
            this.resetState();
            return { cursor: 'crosshair', state: 'idle' };
        }

        // Check if cursor is over another element
        const hit = this.hitTestElement(event.position, scene);

        if (hit && hit.id !== this.startElementId) {
            // Complete the connector
            const endBounds = calculateBounds(hit);
            const endAnchor = closestAnchor(event.position, endBounds);
            const endPoint = getAnchorPosition(endBounds, endAnchor);

            const waypoints = [this.startPoint, endPoint];
            const bounds = computeConnectorBounds(waypoints);
            const elementId = generateConnectorId();
            const now = new Date().toISOString();

            const connectorElement: ConnectorElement = {
                id: elementId,
                pageId: this.currentPageId,
                type: 'connector',
                zIndex: Date.now(),
                createdBy: this.createdBy,
                createdAt: now,
                updatedAt: now,
                data: {
                    startElementId: this.startElementId,
                    endElementId: hit.id,
                    startAnchor: this.startAnchor,
                    endAnchor: endAnchor,
                    waypoints,
                    style: { ...DEFAULT_STROKE_STYLE },
                    arrowStart: false,
                    arrowEnd: true,
                    bounds,
                },
            };

            const mutations = [
                {
                    type: 'create' as const,
                    elementId,
                    pageId: this.currentPageId,
                    data: connectorElement,
                    timestamp: Date.now(),
                },
            ];

            this.resetState();
            return { mutations, cursor: 'crosshair', state: 'idle' };
        }

        // Did not land on a valid target element, cancel
        this.resetState();
        return { cursor: 'crosshair', state: 'idle' };
    }

    onCancel(): ToolResult {
        this.resetState();
        return { state: 'idle' };
    }

    private resetState(): void {
        this.state = 'idle';
        this.startElementId = null;
        this.startAnchor = 'center';
        this.startPoint = null;
    }

    private hitTestElement(
        position: Point,
        scene: SceneState,
    ): Element | null {
        // Iterate in reverse z-order to find topmost element
        for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
            const id = scene.elementOrder[i];
            const el = scene.elements.get(id);
            if (
                el &&
                el.pageId === this.currentPageId &&
                el.type !== 'connector' // Don't connect to other connectors
            ) {
                const bounds = calculateBounds(el);
                if (pointInBounds(position, bounds)) {
                    return el;
                }
            }
        }
        return null;
    }
}
