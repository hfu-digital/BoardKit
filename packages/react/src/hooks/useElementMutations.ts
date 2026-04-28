import { useCallback } from 'react';
import { deepMerge } from '@hfu.digital/boardkit-core';
import type { Element, ElementMutation } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseElementMutationsResult {
    /**
     * Apply a partial patch to an element's `data`. The patch is deep-merged
     * so nested style fields can be updated without rewriting the full style.
     * Mutation flows through the outbound queue so the change persists +
     * broadcasts.
     */
    patchElement: (elementId: string, dataPatch: Partial<Element['data']>) => void;
    /** Replace an element wholesale (rare — `patchElement` is preferred). */
    replaceElement: (element: Element) => void;
    /** Delete one or more elements by id. */
    deleteElements: (ids: string[]) => void;
    /**
     * Bring elements to the top of the z-order (or send to the bottom).
     * Updates `zIndex` and emits `update` mutations.
     */
    reorderElements: (ids: string[], direction: 'front' | 'back' | 'forward' | 'backward') => void;
    /**
     * Duplicate elements with a (+20, +20) world offset and select the
     * duplicates. Emits `create` mutations.
     */
    duplicateElements: (ids: string[]) => string[];
}

export function useElementMutations(): UseElementMutationsResult {
    const { store } = useBoardKit();

    const patchElement = useCallback(
        (elementId: string, dataPatch: Partial<Element['data']>) => {
            const state = store.getState();
            const existing = state.scene.elements.get(elementId);
            if (!existing) return;

            const nextData = deepMerge(existing.data as any, dataPatch as any);
            const nextElement: Element = {
                ...existing,
                data: nextData,
                updatedAt: new Date().toISOString(),
            };

            store.updateScene((scene) => {
                const elements = new Map(scene.elements);
                elements.set(elementId, nextElement);
                return { elements, elementOrder: scene.elementOrder };
            });

            const mutation: ElementMutation = {
                type: 'update',
                elementId,
                pageId: existing.pageId,
                data: nextElement,
                timestamp: Date.now(),
            };
            store.enqueueOutboundMutations([mutation]);
        },
        [store],
    );

    const replaceElement = useCallback(
        (element: Element) => {
            store.updateScene((scene) => {
                const elements = new Map(scene.elements);
                elements.set(element.id, element);
                return { elements, elementOrder: scene.elementOrder };
            });
            store.enqueueOutboundMutations([
                {
                    type: 'update',
                    elementId: element.id,
                    pageId: element.pageId,
                    data: element,
                    timestamp: Date.now(),
                },
            ]);
        },
        [store],
    );

    const deleteElements = useCallback(
        (ids: string[]) => {
            if (ids.length === 0) return;
            const state = store.getState();
            const mutations: ElementMutation[] = [];
            for (const id of ids) {
                const el = state.scene.elements.get(id);
                if (!el) continue;
                mutations.push({
                    type: 'delete',
                    elementId: id,
                    pageId: el.pageId,
                    timestamp: Date.now(),
                });
            }
            store.updateScene((scene) => {
                const elements = new Map(scene.elements);
                for (const id of ids) elements.delete(id);
                return {
                    elements,
                    elementOrder: scene.elementOrder.filter((id) => !ids.includes(id)),
                };
            });
            store.enqueueOutboundMutations(mutations);
            // Drop deleted elements from the selection.
            const sel = new Set(state.selectedIds);
            for (const id of ids) sel.delete(id);
            store.setSelection(sel);
        },
        [store],
    );

    const reorderElements = useCallback(
        (ids: string[], direction: 'front' | 'back' | 'forward' | 'backward') => {
            const state = store.getState();
            // Compute an absolute new zIndex for each element. "front" / "back"
            // pin to the global max+1 / min-1; "forward" / "backward" shift by ±1.
            const allEls = Array.from(state.scene.elements.values());
            if (allEls.length === 0) return;
            let maxZ = -Infinity, minZ = Infinity;
            for (const el of allEls) {
                if (el.zIndex > maxZ) maxZ = el.zIndex;
                if (el.zIndex < minZ) minZ = el.zIndex;
            }
            const mutations: ElementMutation[] = [];
            store.updateScene((scene) => {
                const elements = new Map(scene.elements);
                for (const id of ids) {
                    const el = elements.get(id);
                    if (!el) continue;
                    let nextZ = el.zIndex;
                    if (direction === 'front') nextZ = maxZ + 1;
                    else if (direction === 'back') nextZ = minZ - 1;
                    else if (direction === 'forward') nextZ = el.zIndex + 1;
                    else if (direction === 'backward') nextZ = el.zIndex - 1;
                    const next = { ...el, zIndex: nextZ, updatedAt: new Date().toISOString() } as Element;
                    elements.set(id, next);
                    mutations.push({
                        type: 'update',
                        elementId: id,
                        pageId: el.pageId,
                        data: next,
                        timestamp: Date.now(),
                    });
                }
                return { elements, elementOrder: scene.elementOrder };
            });
            store.enqueueOutboundMutations(mutations);
        },
        [store],
    );

    const duplicateElements = useCallback(
        (ids: string[]): string[] => {
            const state = store.getState();
            const newIds: string[] = [];
            const mutations: ElementMutation[] = [];
            const offset = 20;
            store.updateScene((scene) => {
                const elements = new Map(scene.elements);
                const elementOrder = [...scene.elementOrder];
                for (const id of ids) {
                    const el = elements.get(id);
                    if (!el) continue;
                    const newId = `${el.type}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const data: any = JSON.parse(JSON.stringify(el.data));
                    if (data.position) {
                        data.position = { x: data.position.x + offset, y: data.position.y + offset };
                    }
                    if (data.bounds) {
                        data.bounds = { ...data.bounds, x: data.bounds.x + offset, y: data.bounds.y + offset };
                    }
                    if (Array.isArray(data.points)) {
                        data.points = data.points.map((p: { x: number; y: number }) => ({
                            x: p.x + offset,
                            y: p.y + offset,
                        }));
                    }
                    const nowIso = new Date().toISOString();
                    const dup: Element = { ...el, id: newId, data, createdAt: nowIso, updatedAt: nowIso };
                    elements.set(newId, dup);
                    elementOrder.push(newId);
                    newIds.push(newId);
                    mutations.push({
                        type: 'create',
                        elementId: newId,
                        pageId: el.pageId,
                        data: dup,
                        timestamp: Date.now(),
                    });
                }
                return { elements, elementOrder };
            });
            store.enqueueOutboundMutations(mutations);
            store.setSelection(new Set(newIds));
            return newIds;
        },
        [store],
    );

    return { patchElement, replaceElement, deleteElements, reorderElements, duplicateElements };
}
