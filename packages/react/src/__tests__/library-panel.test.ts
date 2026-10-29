import { describe, expect, it } from 'vitest';
import { BoardStore } from '../store/board-store';
import { parseExcalidrawLib } from '../lib/excalidrawlib-parser';
import {
    DEFAULT_LIBRARY_PANEL_LABELS,
    LIBRARY_PANEL_LOCAL_STORAGE_KEY,
    insertLibraryItem,
} from '../components/LibraryPanel';

const library = parseExcalidrawLib({
    type: 'excalidrawlib',
    version: 2,
    libraryItems: [{
        id: 'item-1',
        name: 'Box and label',
        elements: [
            { type: 'rectangle', x: 10, y: 10, width: 100, height: 40 },
            { type: 'text', x: 20, y: 20, width: 60, height: 20, text: 'Hi' },
        ],
    }],
}, 'Test');

describe('LibraryPanel insertion', () => {
    it('inserts a library item centred on the target as one undoable, persisted step', () => {
        const store = new BoardStore();
        store.setPages([{ id: 'page', boardId: 'b', name: 'Page', order: 0, createdAt: '', updatedAt: '' }] as never);
        store.setActivePageId('page');
        const item = library.items[0];
        const ids = insertLibraryItem(store, item, { x: 500, y: 300 });

        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
        const elements = ids.map((id) => store.getState().scene.elements.get(id)!);
        expect(elements.every((el) => el.pageId === 'page')).toBe(true);
        expect([...store.getState().selectedIds].sort()).toEqual([...ids].sort());
        const rect = elements.find((el) => el.type === 'shape') as { data: { position: { x: number; y: number } } };
        expect(rect.data.position.x).toBeCloseTo(500 - item.bounds.width / 2 + (item.elements[0].data as { position: { x: number } }).position.x);
        expect(store.drainOutboundMutations().map((m) => [m.type, m.elementId])).toEqual(ids.map((id) => ['create', id]));

        const undo = store.getState().history.undo()!;
        store.applyHistoryMutations(undo);
        expect(ids.every((id) => !store.getState().scene.elements.has(id))).toBe(true);
        expect(store.drainOutboundMutations().map((m) => m.type)).toEqual(['delete', 'delete']);

        store.applyHistoryMutations(store.getState().history.redo()!);
        expect(ids.every((id) => store.getState().scene.elements.has(id))).toBe(true);
    });

    it('keeps the legacy storage key and English defaults for existing consumers', () => {
        expect(LIBRARY_PANEL_LOCAL_STORAGE_KEY).toBe('bk-library:v1');
        expect(DEFAULT_LIBRARY_PANEL_LABELS.importFile).toBe('Import .excalidrawlib');
        expect(DEFAULT_LIBRARY_PANEL_LABELS.remove('Arrows')).toBe('Remove Arrows');
    });
});
