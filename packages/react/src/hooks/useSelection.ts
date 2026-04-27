import { useEffect, useState } from 'react';
import type { Element } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseSelectionResult {
    selectedIds: ReadonlySet<string>;
    selectedElements: Element[];
    setSelection: (ids: Iterable<string>) => void;
    clearSelection: () => void;
}

/**
 * Subscribes to both 'selection' and 'scene' so the panel updates when the
 * selection set changes AND when properties on a selected element are
 * patched (otherwise the panel would freeze on stale data after an edit).
 */
export function useSelection(): UseSelectionResult {
    const { store } = useBoardKit();
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
        new Set(store.getState().selectedIds),
    );
    const [selectedElements, setSelectedElements] = useState<Element[]>(() =>
        resolveElements(store.getState()),
    );

    useEffect(() => {
        const sync = () => {
            const state = store.getState();
            setSelectedIds(new Set(state.selectedIds));
            setSelectedElements(resolveElements(state));
        };
        const unsubs = [store.subscribe('selection', sync), store.subscribe('scene', sync)];
        return () => unsubs.forEach((u) => u());
    }, [store]);

    return {
        selectedIds,
        selectedElements,
        setSelection: (ids) => store.setSelection(new Set(ids)),
        clearSelection: () => store.setSelection(new Set()),
    };
}

function resolveElements(state: ReturnType<ReturnType<typeof useBoardKit>['store']['getState']>): Element[] {
    const out: Element[] = [];
    for (const id of state.selectedIds) {
        const el = state.scene.elements.get(id);
        if (el) out.push(el);
    }
    return out;
}
