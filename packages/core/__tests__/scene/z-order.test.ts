import { describe, it, expect } from 'vitest';
import { bringToFront, sendToBack, bringForward, sendBackward, reorder } from '../../src/scene/z-order';
import { createScene, addElement } from '../../src/scene/scene-graph';
import type { StrokeElement } from '../../src/types/elements';
import { DEFAULT_STROKE_STYLE } from '../../src/constants';

function makeStroke(id: string): StrokeElement {
    return {
        id,
        pageId: 'p1',
        type: 'stroke',
        zIndex: 0,
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            points: [{ x: 0, y: 0 }],
            style: { ...DEFAULT_STROKE_STYLE },
            bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
    };
}

function buildScene(ids: string[]) {
    let scene = createScene();
    for (const id of ids) scene = addElement(scene, makeStroke(id));
    return scene;
}

describe('z-order', () => {
    describe('bringToFront', () => {
        it('moves element to end of order', () => {
            const result = bringToFront(buildScene(['a', 'b', 'c']), 'a');
            expect(result.elementOrder).toEqual(['b', 'c', 'a']);
        });

        it('is a no-op for non-existent id', () => {
            const scene = buildScene(['a', 'b']);
            expect(bringToFront(scene, 'z')).toBe(scene);
        });
    });

    describe('sendToBack', () => {
        it('moves element to start of order', () => {
            const result = sendToBack(buildScene(['a', 'b', 'c']), 'c');
            expect(result.elementOrder).toEqual(['c', 'a', 'b']);
        });
    });

    describe('bringForward', () => {
        it('swaps element with the one after it', () => {
            const result = bringForward(buildScene(['a', 'b', 'c']), 'a');
            expect(result.elementOrder).toEqual(['b', 'a', 'c']);
        });

        it('is a no-op when element is already last', () => {
            const scene = buildScene(['a', 'b', 'c']);
            expect(bringForward(scene, 'c')).toBe(scene);
        });
    });

    describe('sendBackward', () => {
        it('swaps element with the one before it', () => {
            const result = sendBackward(buildScene(['a', 'b', 'c']), 'b');
            expect(result.elementOrder).toEqual(['b', 'a', 'c']);
        });

        it('is a no-op when element is already first', () => {
            const scene = buildScene(['a', 'b', 'c']);
            expect(sendBackward(scene, 'a')).toBe(scene);
        });
    });

    describe('reorder', () => {
        it('reorders elements and appends missing ones', () => {
            const scene = buildScene(['a', 'b', 'c']);
            const result = reorder(scene, ['c', 'a']);
            expect(result.elementOrder).toEqual(['c', 'a', 'b']);
        });

        it('ignores invalid ids', () => {
            const scene = buildScene(['a', 'b']);
            const result = reorder(scene, ['z', 'b', 'a']);
            expect(result.elementOrder).toEqual(['b', 'a']);
        });
    });
});
