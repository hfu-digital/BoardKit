import { describe, it, expect } from 'vitest';
import { mergeElement, mergeScene } from '../../src/operations/merge';
import { createScene, addElement } from '../../src/scene/scene-graph';
import type { StrokeElement } from '../../src/types/elements';
import type { ElementMutation } from '../../src/types/events';
import { DEFAULT_STROKE_STYLE } from '../../src/constants';

function makeStroke(id: string, updatedAt: string, zIndex = 0): StrokeElement {
    return {
        id,
        pageId: 'p1',
        type: 'stroke',
        zIndex,
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt,
        data: {
            points: [{ x: 0, y: 0 }],
            style: { ...DEFAULT_STROKE_STYLE },
            bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
    };
}

describe('mergeElement', () => {
    it('returns local when local is newer', () => {
        const local = makeStroke('a', '2024-01-02T00:00:00Z');
        const remote = makeStroke('a', '2024-01-01T00:00:00Z');
        expect(mergeElement(local, remote)).toBe(local);
    });

    it('returns remote when remote is newer', () => {
        const local = makeStroke('a', '2024-01-01T00:00:00Z');
        const remote = makeStroke('a', '2024-01-02T00:00:00Z');
        expect(mergeElement(local, remote)).toBe(remote);
    });

    it('returns remote on tie (server authority)', () => {
        const local = makeStroke('a', '2024-01-01T00:00:00Z');
        const remote = makeStroke('a', '2024-01-01T00:00:00Z');
        expect(mergeElement(local, remote)).toBe(remote);
    });
});

describe('mergeScene', () => {
    it('applies create mutation for new element', () => {
        const scene = createScene();
        const stroke = makeStroke('new-1', '2024-01-01T00:00:00Z');
        const mutations: ElementMutation[] = [{
            type: 'create',
            elementId: 'new-1',
            pageId: 'p1',
            data: stroke,
            timestamp: '2024-01-01T00:00:00Z',
        }];
        const result = mergeScene(scene, mutations);
        expect(result.elements.size).toBe(1);
        expect(result.elementOrder).toContain('new-1');
    });

    it('applies delete mutation', () => {
        const scene = addElement(createScene(), makeStroke('a', '2024-01-01T00:00:00Z'));
        const mutations: ElementMutation[] = [{
            type: 'delete',
            elementId: 'a',
            pageId: 'p1',
            timestamp: '2024-01-01T00:00:00Z',
        }];
        const result = mergeScene(scene, mutations);
        expect(result.elements.size).toBe(0);
    });

    it('applies update mutation with LWW - remote wins when newer', () => {
        const scene = addElement(createScene(), makeStroke('a', '2024-01-01T00:00:00Z'));
        const mutations: ElementMutation[] = [{
            type: 'update',
            elementId: 'a',
            pageId: 'p1',
            data: { zIndex: 99, updatedAt: '2024-01-02T00:00:00Z' },
            timestamp: '2024-01-02T00:00:00Z',
        }];
        const result = mergeScene(scene, mutations);
        expect(result.elements.get('a')!.zIndex).toBe(99);
    });

    it('skips update when local is newer', () => {
        const scene = addElement(createScene(), makeStroke('a', '2024-01-02T00:00:00Z'));
        const mutations: ElementMutation[] = [{
            type: 'update',
            elementId: 'a',
            pageId: 'p1',
            data: { zIndex: 99, updatedAt: '2024-01-01T00:00:00Z' },
            timestamp: '2024-01-01T00:00:00Z',
        }];
        const result = mergeScene(scene, mutations);
        expect(result.elements.get('a')!.zIndex).toBe(0);
    });
});
