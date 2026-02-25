import { describe, it, expect } from 'vitest';
import {
    createScene,
    addElement,
    removeElement,
    updateElement,
    getElement,
    getElementsByPage,
    loadElements,
} from '../../src/scene/scene-graph';
import type { StrokeElement } from '../../src/types/elements';
import { DEFAULT_STROKE_STYLE } from '../../src/constants';

function makeStroke(id: string, pageId = 'page-1', zIndex = 0): StrokeElement {
    return {
        id,
        pageId,
        type: 'stroke',
        zIndex,
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        data: {
            points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
            style: { ...DEFAULT_STROKE_STYLE },
            bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
    };
}

describe('scene-graph', () => {
    describe('createScene', () => {
        it('returns an empty scene', () => {
            const scene = createScene();
            expect(scene.elements.size).toBe(0);
            expect(scene.elementOrder).toEqual([]);
        });
    });

    describe('addElement', () => {
        it('adds an element and preserves order', () => {
            const scene = addElement(createScene(), makeStroke('a'));
            expect(scene.elements.size).toBe(1);
            expect(scene.elementOrder).toEqual(['a']);
        });

        it('does not mutate the original scene', () => {
            const original = createScene();
            addElement(original, makeStroke('a'));
            expect(original.elements.size).toBe(0);
        });
    });

    describe('removeElement', () => {
        it('removes an existing element', () => {
            let scene = addElement(createScene(), makeStroke('a'));
            scene = addElement(scene, makeStroke('b'));
            scene = removeElement(scene, 'a');
            expect(scene.elements.size).toBe(1);
            expect(scene.elementOrder).toEqual(['b']);
        });

        it('is a no-op for non-existent id', () => {
            const scene = addElement(createScene(), makeStroke('a'));
            const result = removeElement(scene, 'nope');
            expect(result.elements.size).toBe(1);
        });
    });

    describe('updateElement', () => {
        it('patches an existing element', () => {
            const scene = addElement(createScene(), makeStroke('a'));
            const updated = updateElement(scene, 'a', { zIndex: 99 });
            expect(updated.elements.get('a')!.zIndex).toBe(99);
        });

        it('returns same scene if element does not exist', () => {
            const scene = createScene();
            const result = updateElement(scene, 'nope', { zIndex: 1 });
            expect(result).toBe(scene);
        });

        it('preserves the element id even if patch tries to change it', () => {
            const scene = addElement(createScene(), makeStroke('a'));
            const updated = updateElement(scene, 'a', { id: 'b' } as any);
            expect(updated.elements.has('a')).toBe(true);
        });
    });

    describe('getElement', () => {
        it('returns the element by id', () => {
            const scene = addElement(createScene(), makeStroke('a'));
            expect(getElement(scene, 'a')?.id).toBe('a');
        });

        it('returns undefined for missing id', () => {
            expect(getElement(createScene(), 'nope')).toBeUndefined();
        });
    });

    describe('getElementsByPage', () => {
        it('filters elements by pageId in order', () => {
            let scene = createScene();
            scene = addElement(scene, makeStroke('a', 'p1'));
            scene = addElement(scene, makeStroke('b', 'p2'));
            scene = addElement(scene, makeStroke('c', 'p1'));

            const p1 = getElementsByPage(scene, 'p1');
            expect(p1.map((e) => e.id)).toEqual(['a', 'c']);
        });
    });

    describe('loadElements', () => {
        it('sorts elements by zIndex', () => {
            const elements = [
                makeStroke('c', 'p1', 3),
                makeStroke('a', 'p1', 1),
                makeStroke('b', 'p1', 2),
            ];
            const scene = loadElements(elements);
            expect(scene.elementOrder).toEqual(['a', 'b', 'c']);
        });
    });
});
