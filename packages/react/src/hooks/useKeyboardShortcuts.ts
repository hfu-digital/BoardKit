import { useEffect } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';
import {
    TOOL_IDS,
    serializeSelection,
    deserializeSelection,
    addElement,
    calculateBounds,
    mergeBounds,
} from '@boardkit/core';
import type { Element, Point } from '@boardkit/core';
import { MIN_ZOOM, MAX_ZOOM } from '../engine/viewport';

// Module-level clipboard (not system clipboard)
let internalClipboard: string | null = null;

export function useKeyboardShortcuts(): void {
    const { store } = useBoardKit();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const target = e.target as HTMLElement;

            // Don't capture when typing in input fields
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // Undo: Ctrl+Z
            if (isCtrl && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                const mutations = store.getState().history.undo();
                if (mutations) {
                    store.updateScene((s) => s);
                }
                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (
                (isCtrl && e.key === 'y') ||
                (isCtrl && e.key === 'z' && e.shiftKey)
            ) {
                e.preventDefault();
                const mutations = store.getState().history.redo();
                if (mutations) {
                    store.updateScene((s) => s);
                }
                return;
            }

            // Delete selected
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                const { selectedIds } = store.getState();
                if (selectedIds.size > 0) {
                    store.updateScene((scene) => {
                        let s = scene;
                        for (const id of selectedIds) {
                            const elements = new Map(s.elements);
                            elements.delete(id);
                            s = {
                                elements,
                                elementOrder: s.elementOrder.filter(
                                    (eid) => eid !== id,
                                ),
                            };
                        }
                        return s;
                    });
                    store.setSelection(new Set());
                }
                return;
            }

            // Select all: Ctrl+A
            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                const { scene } = store.getState();
                store.setSelection(
                    new Set(scene.elements.keys()),
                );
                return;
            }

            // Copy: Ctrl+C
            if (isCtrl && e.key === 'c' && !e.shiftKey) {
                e.preventDefault();
                const { selectedIds, scene } = store.getState();
                if (selectedIds.size === 0) return;

                const selectedElements: Element[] = [];
                for (const id of selectedIds) {
                    const el = scene.elements.get(id);
                    if (el) selectedElements.push(el);
                }

                internalClipboard = serializeSelection(selectedElements);
                return;
            }

            // Paste: Ctrl+V
            if (isCtrl && e.key === 'v' && !e.shiftKey) {
                e.preventDefault();
                if (!internalClipboard) return;

                // Calculate center of viewport as paste position
                const { viewport } = store.getState();
                // Assume a reasonable viewport size; use window dimensions
                const viewportCenterScreen: Point = {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                };
                const pastePosition: Point = {
                    x: (viewportCenterScreen.x - viewport.offset.x) / viewport.zoom,
                    y: (viewportCenterScreen.y - viewport.offset.y) / viewport.zoom,
                };

                const newElements = deserializeSelection(internalClipboard, pastePosition);
                if (newElements.length === 0) return;

                store.updateScene((scene) => {
                    let s = scene;
                    for (const el of newElements) {
                        s = addElement(s, el);
                    }
                    return s;
                });

                // Select the pasted elements
                const pastedIds = new Set(newElements.map((el) => el.id));
                store.setSelection(pastedIds);
                return;
            }

            // Duplicate: Ctrl+D
            if (isCtrl && e.key === 'd') {
                e.preventDefault();
                const { selectedIds, scene } = store.getState();
                if (selectedIds.size === 0) return;

                const selectedElements: Element[] = [];
                for (const id of selectedIds) {
                    const el = scene.elements.get(id);
                    if (el) selectedElements.push(el);
                }

                const serialized = serializeSelection(selectedElements);

                // Parse to get centroid, then offset by (+20, +20)
                const parsed = JSON.parse(serialized);
                const centroid: Point = parsed.centroid ?? { x: 0, y: 0 };
                const offsetPosition: Point = {
                    x: centroid.x + 20,
                    y: centroid.y + 20,
                };

                const duplicated = deserializeSelection(serialized, offsetPosition);
                if (duplicated.length === 0) return;

                store.updateScene((scene) => {
                    let s = scene;
                    for (const el of duplicated) {
                        s = addElement(s, el);
                    }
                    return s;
                });

                // Select the duplicated elements
                const duplicatedIds = new Set(duplicated.map((el) => el.id));
                store.setSelection(duplicatedIds);
                return;
            }

            // Group: Ctrl+G (placeholder)
            if (isCtrl && e.key === 'g') {
                e.preventDefault();
                console.log('Group: not yet implemented');
                return;
            }

            // Fit to content: Ctrl+Shift+F
            if (isCtrl && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                const { scene } = store.getState();
                const allElements = Array.from(scene.elements.values());
                if (allElements.length === 0) return;

                // Calculate bounding box of all elements
                const allBounds = allElements.map((el) => calculateBounds(el));
                const contentBounds = mergeBounds(allBounds);

                if (contentBounds.width === 0 || contentBounds.height === 0) return;

                // Use window dimensions as the available viewport area
                const padding = 40;
                const availableWidth = window.innerWidth - padding * 2;
                const availableHeight = window.innerHeight - padding * 2;

                // Calculate zoom to fit content
                const scaleX = availableWidth / contentBounds.width;
                const scaleY = availableHeight / contentBounds.height;
                let zoom = Math.min(scaleX, scaleY);
                zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

                // Calculate offset to center the content
                const contentCenterX = contentBounds.x + contentBounds.width / 2;
                const contentCenterY = contentBounds.y + contentBounds.height / 2;
                const offset: Point = {
                    x: window.innerWidth / 2 - contentCenterX * zoom,
                    y: window.innerHeight / 2 - contentCenterY * zoom,
                };

                store.updateViewport(() => ({ zoom, offset }));
                return;
            }

            // Reset zoom: Ctrl+0
            if (isCtrl && e.key === '0') {
                e.preventDefault();
                store.updateViewport(() => ({
                    zoom: 1,
                    offset: { x: 0, y: 0 },
                }));
                return;
            }

            // Tool shortcuts (number keys)
            const toolMap: Record<string, string> = {
                '1': TOOL_IDS.SELECT,
                '2': TOOL_IDS.PEN,
                '3': TOOL_IDS.SHAPE,
                '4': TOOL_IDS.TEXT,
                '5': TOOL_IDS.ERASER,
                '6': TOOL_IDS.HAND,
                '7': TOOL_IDS.STICKY_NOTE,
                '8': TOOL_IDS.CONNECTOR,
                '9': TOOL_IDS.LASER,
            };
            if (toolMap[e.key]) {
                store.setActiveTool(toolMap[e.key]);
                return;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [store]);
}
