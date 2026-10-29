import type { Board, Page, Element, ElementMutation } from '@hfu.digital/boardkit-core';
import type { BoardStore } from './board-store';

export function applyMutations(store: BoardStore, mutations: ElementMutation[]): void {
    const pages = new Set(store.getState().pages.map(p => p.id));
    store.updateScene(scene => {
        const elements = new Map(scene.elements);
        for (const m of mutations) {
            if (!pages.has(m.pageId)) continue;
            if (m.type === 'delete') elements.delete(m.elementId);
            else if (m.data) {
                const old = elements.get(m.elementId);
                if (m.type === 'create' || old) elements.set(m.elementId, { ...old, ...m.data } as Element);
            }
        }
        return { elements, elementOrder: [...elements.values()].sort((a,b) => a.zIndex-b.zIndex).map(e => e.id) };
    });
}

export function hydrateScene(store: BoardStore, payload: { board?: Board; pages?: Page[]; elements?: Record<string, Element[]> }, pending: ElementMutation[] = []): void {
    if (payload.board) store.setBoard(payload.board);
    if (payload.pages) store.setPages(payload.pages);
    const elements = new Map<string, Element>();
    for (const page of store.getState().pages) for (const el of payload.elements?.[page.id] ?? []) {
        if (el.pageId === page.id) elements.set(el.id, el);
    }
    store.updateScene(() => ({ elements, elementOrder: [...elements.values()].sort((a,b) => a.zIndex-b.zIndex).map(e => e.id) }));
    applyMutations(store, [...pending, ...store.getState().outboundMutations]);
    store.setHydrated(true);
}
