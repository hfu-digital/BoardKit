import { describe, it, expect } from 'vitest';
import { SelectTool } from '../../src/tools/select.tool';
import type { InputEvent, ShapeElement } from '../../src/index';
import { loadElements, type SceneState } from '../../src/scene/scene-graph';
import { DEFAULT_SHAPE_STYLE } from '../../src/constants';

function makeShape(
    id: string,
    x: number,
    y: number,
    width = 100,
    height = 60,
    pageId = 'p1',
): ShapeElement {
    return {
        id,
        pageId,
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
    modifiers: Partial<InputEvent['modifiers']> = {},
): InputEvent {
    return {
        type,
        position: pos,
        button: 0,
        modifiers: {
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
            ...modifiers,
        },
        timestamp: 0,
    };
}

function freshTool(): SelectTool {
    const t = new SelectTool();
    t.setPageId('p1');
    return t;
}

describe('SelectTool — alignment snap', () => {
    it('snaps the moving shape to a neighbour left edge within threshold', () => {
        // Static shape A at x=200..300. We grab a shape at x=0..100 and drag
        // its left edge to x=203 (3px past A.left, within the 5px threshold).
        const a = makeShape('A', 200, 0);
        const b = makeShape('B', 0, 0);
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        // Click on B's top stroke and drag right by 203 px.
        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 0 }), scene);
        const result = tool.onPointerMove(
            makeEvent('pointerMove', { x: 253, y: 0 }),
            scene,
        );

        const previewB = result.preview?.find((el) => el.id === 'B') as
            | ShapeElement
            | undefined;
        expect(previewB).toBeDefined();
        // Snap engaged → B's left edge lands exactly on A's left edge (200).
        expect(previewB!.data.position.x).toBeCloseTo(200, 6);
        expect(result.alignmentGuides).toBeDefined();
        const verticals = result.alignmentGuides!.filter((g) => g.type === 'vertical');
        expect(verticals.length).toBeGreaterThan(0);
        expect(verticals[0].position).toBeCloseTo(200, 6);
    });

    it('snaps centre-Y to centre-Y when within threshold', () => {
        // Static A at y=0..60 → centerY = 30. B at y=0..60 → centerY = 30.
        // Drag B down by 2 → B.centerY = 32, |32-30| = 2 within threshold.
        // Snap should pull B back to y=0 so the centerYs align exactly.
        const a = makeShape('A', 200, 0);
        const b = makeShape('B', 0, 0);
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 0 }), scene);
        // Drag past the 5px arm threshold with a non-trivial X delta, then
        // bring Y back to a small value so centerY-to-centerY is the closest
        // horizontal match.
        tool.onPointerMove(makeEvent('pointerMove', { x: 60, y: 10 }), scene);
        const result = tool.onPointerMove(
            makeEvent('pointerMove', { x: 60, y: 2 }),
            scene,
        );

        const previewB = result.preview?.find((el) => el.id === 'B') as
            | ShapeElement
            | undefined;
        expect(previewB).toBeDefined();
        expect(previewB!.data.position.y).toBeCloseTo(0, 6);
        const horizontals = result.alignmentGuides!.filter((g) => g.type === 'horizontal');
        expect(horizontals.length).toBeGreaterThan(0);
    });

    it('does not snap when meta modifier is held', () => {
        const a = makeShape('A', 200, 0);
        const b = makeShape('B', 0, 0);
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 0 }), scene);
        const result = tool.onPointerMove(
            makeEvent('pointerMove', { x: 253, y: 0 }, { meta: true }),
            scene,
        );

        const previewB = result.preview?.find((el) => el.id === 'B') as
            | ShapeElement
            | undefined;
        // Drag delta is (253 - 50) = 203 → B.x = 203, NOT snapped to 200.
        expect(previewB!.data.position.x).toBeCloseTo(203, 6);
        expect(result.alignmentGuides).toEqual([]);
    });

    it('ignores elements on a different page when snapping', () => {
        // A is on page p2 — should never be a snap target while B (on p1) drags.
        const a = makeShape('A', 200, 0, 100, 60, 'p2');
        const b = makeShape('B', 0, 0);
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 0 }), scene);
        const result = tool.onPointerMove(
            makeEvent('pointerMove', { x: 253, y: 0 }),
            scene,
        );

        const previewB = result.preview?.find((el) => el.id === 'B') as
            | ShapeElement
            | undefined;
        // No snap target on this page → raw delta of 203.
        expect(previewB!.data.position.x).toBeCloseTo(203, 6);
        expect(result.alignmentGuides).toEqual([]);
    });

    it('persists the snapped position on pointerup commit', () => {
        const a = makeShape('A', 200, 0);
        const b = makeShape('B', 0, 0);
        const scene: SceneState = loadElements([a, b]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 0 }), scene);
        tool.onPointerMove(makeEvent('pointerMove', { x: 253, y: 0 }), scene);
        const up = tool.onPointerUp(
            makeEvent('pointerUp', { x: 253, y: 0 }),
            scene,
        );

        const muteB = up.mutations?.find((m) => m.elementId === 'B');
        expect(muteB).toBeDefined();
        const newB = (muteB!.data as Partial<ShapeElement>).data!;
        // Committed position matches the snapped preview, not the raw delta.
        expect(newB.position.x).toBeCloseTo(200, 6);
    });
});
