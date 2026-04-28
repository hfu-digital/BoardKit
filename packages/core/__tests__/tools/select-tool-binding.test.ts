import { describe, it, expect } from 'vitest';
import { SelectTool } from '../../src/tools/select.tool';
import type {
    InputEvent,
    LinearElement,
    ShapeElement,
} from '../../src/index';
import { loadElements, type SceneState } from '../../src/scene/scene-graph';
import { DEFAULT_SHAPE_STYLE, DEFAULT_STROKE_STYLE } from '../../src/constants';

function makeShape(id: string, x: number, y: number): ShapeElement {
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
            size: { width: 100, height: 60 },
            rotation: 0,
            style: { ...DEFAULT_SHAPE_STYLE },
            bounds: { x, y, width: 100, height: 60 },
        },
    };
}

function makeArrow(
    id: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
    bindings: { startBinding?: { elementId: string }; endBinding?: { elementId: string } } = {},
): LinearElement {
    return {
        id,
        pageId: 'p1',
        type: 'linear',
        zIndex: 1,
        createdBy: 'u1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            linearType: 'arrow',
            points: [start, end],
            rotation: 0,
            style: { ...DEFAULT_STROKE_STYLE },
            roughness: 0,
            seed: 1,
            arrowStart: false,
            arrowEnd: true,
            bounds: {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(end.x - start.x),
                height: Math.abs(end.y - start.y),
            },
            ...bindings,
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

function freshTool(): SelectTool {
    const t = new SelectTool();
    t.setPageId('p1');
    return t;
}

describe('SelectTool — binding propagation on move', () => {
    it('emits an update mutation for an arrow bound to a moved shape', () => {
        const a = makeShape('A', 0, 0);
        const b = makeShape('B', 300, 0);
        const arrow = makeArrow('arr', { x: 100, y: 30 }, { x: 300, y: 30 }, {
            startBinding: { elementId: 'A' },
            endBinding: { elementId: 'B' },
        });
        const scene: SceneState = loadElements([a, b, arrow]);
        const tool = freshTool();

        // Click shape A (selecting it via hit-test).
        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        // Drag right by 50 px (past the 5 px arm threshold).
        tool.onPointerMove(makeEvent('pointerMove', { x: 100, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 100, y: 30 }),
            scene,
        );

        expect(result.mutations).toBeDefined();
        const arrowMut = result.mutations!.find((m) => m.elementId === 'arr');
        expect(arrowMut).toBeDefined();
        const newArrow = (arrowMut!.data as Partial<LinearElement>).data!;
        // A moved by +50 → its right edge is now at x = 150. B unmoved → left
        // edge at x = 300. The arrow's start should snap to A's new right
        // edge midpoint, end to B's left.
        expect(newArrow.points[0].x).toBeCloseTo(150, 6);
        expect(newArrow.points[1].x).toBeCloseTo(300, 6);
        expect(newArrow.bounds.width).toBeCloseTo(150, 6);
    });

    it('does not emit an arrow mutation when the arrow has no bindings', () => {
        const a = makeShape('A', 0, 0);
        // Arrow well clear of shape A so the click doesn't hit it.
        const arrow = makeArrow('arr', { x: 200, y: 200 }, { x: 400, y: 200 });
        const scene: SceneState = loadElements([a, arrow]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        tool.onPointerMove(makeEvent('pointerMove', { x: 100, y: 30 }), scene);
        const result = tool.onPointerUp(
            makeEvent('pointerUp', { x: 100, y: 30 }),
            scene,
        );
        const ids = (result.mutations ?? []).map((m) => m.elementId).sort();
        expect(ids).toEqual(['A']);
    });

    it('emits a preview that includes the recomputed arrow during drag', () => {
        const a = makeShape('A', 0, 0);
        const b = makeShape('B', 300, 0);
        const arrow = makeArrow('arr', { x: 100, y: 30 }, { x: 300, y: 30 }, {
            startBinding: { elementId: 'A' },
            endBinding: { elementId: 'B' },
        });
        const scene: SceneState = loadElements([a, b, arrow]);
        const tool = freshTool();

        tool.onPointerDown(makeEvent('pointerDown', { x: 50, y: 30 }), scene);
        const result = tool.onPointerMove(
            makeEvent('pointerMove', { x: 100, y: 30 }),
            scene,
        );
        expect(result.preview).toBeDefined();
        const previewArrow = result.preview!.find((el) => el.id === 'arr') as
            | LinearElement
            | undefined;
        expect(previewArrow).toBeDefined();
        expect(previewArrow!.data.points[0].x).toBeCloseTo(150, 6);
    });
});
