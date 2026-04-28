import { describe, it, expect } from 'vitest';
import { ArrowTool } from '../../src/tools/arrow.tool';
import type {
    InputEvent,
    LinearElement,
    ShapeElement,
} from '../../src/index';
import { loadElements, type SceneState } from '../../src/scene/scene-graph';
import { DEFAULT_SHAPE_STYLE } from '../../src/constants';

function makeShape(
    id: string,
    {
        x,
        y,
        width = 100,
        height = 60,
    }: { x: number; y: number; width?: number; height?: number },
): ShapeElement {
    return {
        id,
        pageId: 'p1',
        type: 'shape',
        zIndex: 0,
        createdBy: 'u1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            shapeType: 'rectangle',
            position: { x, y },
            size: { width, height },
            rotation: 0,
            style: { ...DEFAULT_SHAPE_STYLE },
            bounds: { x, y, width, height },
        },
    };
}

function makeEvent(
    type: InputEvent['type'],
    pos: { x: number; y: number },
): InputEvent {
    return {
        type,
        position: pos,
        button: 0,
        modifiers: { shift: false, ctrl: false, alt: false, meta: false },
        timestamp: 0,
    };
}

function freshTool(): ArrowTool {
    const t = new ArrowTool();
    t.setPageId('p1');
    t.setCreatedBy('u1');
    return t;
}

describe('LinearTool — binding capture', () => {
    it('binds the start when pointer-down is inside a shape', () => {
        const shape = makeShape('A', { x: 0, y: 0 });
        const scene: SceneState = loadElements([shape]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        // Drag well outside any shape so end is free.
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 500, y: 500 }),
            scene,
        );
        expect(result.mutations).toBeDefined();
        const data = result.mutations![0].data as LinearElement;
        expect(data.data.startBinding).toEqual({ elementId: 'A' });
        expect(data.data.endBinding).toBeUndefined();
    });

    it('binds the start when pointer-down is within proximity of the perimeter (11 px)', () => {
        const shape = makeShape('A', { x: 0, y: 0 });
        const scene: SceneState = loadElements([shape]);
        const tool = freshTool();

        // 11 px outside the right edge (x = 100): inside the 12 px window.
        tool.onPointerDown(makeEvent('pointerDown', { x: 111, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 500, y: 500 }),
            scene,
        );
        const data = result.mutations![0].data as LinearElement;
        expect(data.data.startBinding).toEqual({ elementId: 'A' });
    });

    it('does NOT bind when pointer-down is 13 px outside the perimeter', () => {
        const shape = makeShape('A', { x: 0, y: 0 });
        const scene: SceneState = loadElements([shape]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 113, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 500, y: 500 }),
            scene,
        );
        const data = result.mutations![0].data as LinearElement;
        expect(data.data.startBinding).toBeUndefined();
    });

    it('binds the end on pointer-up over a second shape', () => {
        const a = makeShape('A', { x: 0, y: 0 });
        const b = makeShape('B', { x: 300, y: 0 });
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 350, y: 30 }),
            scene,
        );
        const data = result.mutations![0].data as LinearElement;
        expect(data.data.startBinding).toEqual({ elementId: 'A' });
        expect(data.data.endBinding).toEqual({ elementId: 'B' });
    });

    it('stores points at the perimeter intersections, not the raw cursor positions', () => {
        const a = makeShape('A', { x: 0, y: 0 });
        const b = makeShape('B', { x: 300, y: 0 });
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 350, y: 30 }),
            scene,
        );
        const data = result.mutations![0].data as LinearElement;
        const [start, end] = data.data.points;
        // A's right edge mid → (100, 30). B's left edge mid → (300, 30).
        expect(start.x).toBeCloseTo(100, 6);
        expect(start.y).toBeCloseTo(30, 6);
        expect(end.x).toBeCloseTo(300, 6);
        expect(end.y).toBeCloseTo(30, 6);
        // Bounds match the resolved points.
        expect(data.data.bounds.x).toBeCloseTo(100, 6);
        expect(data.data.bounds.width).toBeCloseTo(200, 6);
    });

    it('emits a binding preview during pointer-move while dragging', () => {
        const a = makeShape('A', { x: 0, y: 0 });
        const b = makeShape('B', { x: 300, y: 0 });
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        const moveResult = tool.onPointerMove(
            makeEvent('pointerMove', { x: 350, y: 30 }),
            scene,
        );
        expect(moveResult.bindingPreview).toBeDefined();
        const previews = moveResult.bindingPreview!;
        const ids = previews.map((p) => p.candidateShapeId).sort();
        expect(ids).toEqual(['A', 'B']);
    });

    it('emits a hover-only binding preview before pointer-down', () => {
        const a = makeShape('A', { x: 0, y: 0 });
        const scene: SceneState = loadElements([a]);
        const tool = freshTool();

        const moveResult = tool.onPointerMove(
            makeEvent('pointerMove', { x: 50, y: 30 }),
            scene,
        );
        expect(moveResult.bindingPreview).toBeDefined();
        expect(moveResult.bindingPreview![0].candidateShapeId).toBe('A');
    });
});
