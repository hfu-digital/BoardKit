import { describe, expect, it } from 'vitest';
import type { ElementMutation } from '@hfu.digital/boardkit-core';
import { BoardStore } from '../store/board-store';
import { createStarterTemplate } from '../specialized/presets';
import { connectionNodes } from '../specialized/elements';

describe('specialty history persistence', () => {
    it('connects each automaton state once despite the accepting state double circle', () => {
        const elements = createStarterTemplate('automata', 'page', 'user');
        const selected = elements.filter(element => element.type === 'group' || element.type === 'shape');
        expect(connectionNodes(selected, elements)).toHaveLength(2);
    });
    it('undoes and redoes a grouped insertion and queues every change for peers', () => {
        const store = new BoardStore();
        const elements = createStarterTemplate('uml', 'page', 'user');
        const created: ElementMutation[] = elements.map(element => ({
            type: 'create', elementId: element.id, pageId: 'page', data: element, timestamp: 1,
        }));
        store.getState().history.push({ execute: () => created, undo: () => created.map(m => ({ ...m, type: 'delete', data: undefined })) });
        store.applyHistoryMutations(created);
        expect(store.getState().scene.elements.size).toBe(elements.length);
        expect(store.drainOutboundMutations()).toEqual(created);
        store.applyHistoryMutations(store.getState().history.undo()!);
        expect(store.getState().scene.elements.size).toBe(0);
        expect(store.drainOutboundMutations()).toHaveLength(elements.length);
        store.applyHistoryMutations(store.getState().history.redo()!);
        expect(store.getState().scene.elements.size).toBe(elements.length);
        expect(store.drainOutboundMutations()).toEqual(created);
    });
    it('restores complete element metadata when a snapped card is undone', () => {
        const store = new BoardStore();
        const [element] = createStarterTemplate('kanban', 'page', 'user');
        store.applyHistoryMutations([{ type: 'create', elementId: element.id, pageId: 'page', data: element, timestamp: 1 }]);
        store.applyHistoryMutations([{ type: 'update', elementId: element.id, pageId: 'page', data: { ...element, zIndex: 123 }, timestamp: 2 }]);
        expect(store.getState().scene.elements.get(element.id)?.zIndex).toBe(123);
        store.applyHistoryMutations([{ type: 'update', elementId: element.id, pageId: 'page', data: element, timestamp: 3 }]);
        expect(store.getState().scene.elements.get(element.id)).toEqual(element);
    });
});

it('shared async starter factory covers all twelve board types', async () => {
    const { createStarterElements } = await import('../specialized/starter-elements');
    for (const type of ['uml','er','flowchart','automata','network','mind-map','wireframe','kanban','brainstorm','lecture-notes','math','circuit']) {
        const elements = await createStarterElements(type,'page','user');
        expect(elements.length).toBeGreaterThan(0);
        expect(elements.every(el => el.pageId === 'page')).toBe(true);
        expect(new Set(elements.map(el => el.id)).size).toBe(elements.length);
    }
});
