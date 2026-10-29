import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Library, X, Plus } from 'lucide-react';
import type { Element, ElementMutation } from '@hfu.digital/boardkit-core';
import { addElement, removeElement, updateElement } from '@hfu.digital/boardkit-core';
import { parseExcalidrawLib, type ParsedLibrary, type ParsedLibraryItem } from '../lib/excalidrawlib-parser';
import { useBoardKit } from '../context/BoardKitProvider';
import type { BoardStore } from '../store/board-store';
import { Tooltip } from './Tooltip';

/** localStorage key used by the uncontrolled (local-only) panel. */
export const LIBRARY_PANEL_LOCAL_STORAGE_KEY = 'bk-library:v1';
const STORAGE_KEY = LIBRARY_PANEL_LOCAL_STORAGE_KEY;

/** One imported library as the panel stores and renders it. */
export interface LibraryPanelLibrary {
    name: string;
    items: ParsedLibraryItem[];
    addedAt: string;
}

/** User-visible strings; parameterised ones are functions. */
export interface LibraryPanelLabels {
    toggle: string;
    title: string;
    close: string;
    importFile: string;
    empty: string;
    remove: (libraryName: string) => string;
    insert: (itemName: string) => string;
    importFailed: (message: string) => string;
}

export const DEFAULT_LIBRARY_PANEL_LABELS: LibraryPanelLabels = {
    toggle: 'Library',
    title: 'Library',
    close: 'Close library',
    importFile: 'Import .excalidrawlib',
    empty: 'No libraries yet. Import an .excalidrawlib file to get started.',
    remove: (name) => `Remove ${name}`,
    insert: (name) => `Insert ${name}`,
    importFailed: (message) => `Failed to import library: ${message}`,
};

export interface LibraryPanelProps {
    className?: string;
    /**
     * Controlled libraries. When provided (even as an empty array) the panel
     * never reads or writes localStorage; the host owns persistence and
     * receives changes through `onLibrariesChange`.
     */
    libraries?: LibraryPanelLibrary[];
    /** Next library list after an import or removal (controlled mode). */
    onLibrariesChange?: (next: LibraryPanelLibrary[]) => void;
    /** Blocks import and removal (e.g. while loading, saving or resolving a conflict). Inserting stays available. */
    readOnly?: boolean;
    /** Blocks inserting items (e.g. for viewers). */
    insertDisabled?: boolean;
    /** Import failures; defaults to `alert()` with `labels.importFailed`. */
    onImportError?: (error: Error) => void;
    /** Rendered below the header: sync status, conflict actions, migration offers. */
    notice?: ReactNode;
    /** Localised strings; missing entries fall back to English defaults. */
    labels?: Partial<LibraryPanelLabels>;
}

/**
 * Slide-in library panel anchored top-right by the consumer. Imports
 * .excalidrawlib JSON files (drag from the OS file picker) and renders
 * each library item as a clickable card. Click → drop the item at the
 * viewport center, select the new elements and record one undo step.
 *
 * Uncontrolled, libraries persist in localStorage. Pass `libraries` and
 * `onLibrariesChange` to store them elsewhere (e.g. per signed-in user).
 */
export function LibraryPanel({
    className,
    libraries: controlled,
    onLibrariesChange,
    readOnly = false,
    insertDisabled = false,
    onImportError,
    notice,
    labels: labelOverrides,
}: LibraryPanelProps) {
    const { store } = useBoardKit();
    const labels = { ...DEFAULT_LIBRARY_PANEL_LABELS, ...labelOverrides };
    const importFailed = labels.importFailed;
    const isControlled = controlled !== undefined;
    const [open, setOpen] = useState(false);
    const [local, setLocal] = useState<LibraryPanelLibrary[]>(() => (isControlled ? [] : loadLibraries()));
    const libraries = controlled ?? local;

    useEffect(() => {
        if (isControlled) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
        } catch {
            // localStorage may be unavailable in some sandboxes — fail silently.
        }
    }, [local, isControlled]);

    const update = useCallback(
        (fn: (prev: LibraryPanelLibrary[]) => LibraryPanelLibrary[]) => {
            if (isControlled) onLibrariesChange?.(fn(controlled));
            else setLocal(fn);
        },
        [isControlled, controlled, onLibrariesChange],
    );

    const handleFile = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const parsed: ParsedLibrary = parseExcalidrawLib(JSON.parse(text), file.name.replace(/\.excalidrawlib$/i, ''));
            update((prev) => [...prev, { name: parsed.name, items: parsed.items, addedAt: new Date().toISOString() }]);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            if (onImportError) onImportError(error);
            else alert(importFailed(error.message));
        }
    }, [update, onImportError, importFailed]);

    const insertItem = useCallback((item: ParsedLibraryItem) => {
        const state = store.getState();
        // Drop at viewport center.
        const cx = (window.innerWidth / 2 - state.viewport.offset.x) / state.viewport.zoom;
        const cy = (window.innerHeight / 2 - state.viewport.offset.y) / state.viewport.zoom;
        insertLibraryItem(store, item, { x: cx, y: cy });
    }, [store]);

    // Wrapper is inline-block + relative so the button stays at its natural
    // 36×36 size (anchoring the consumer's absolute positioning) and the
    // panel floats below as `position: absolute`. Without this, when the
    // 240px panel mounts as a sibling of the button, the consumer's
    // top-right wrapper grows to fit the panel and drags the button left.
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <Tooltip label={labels.toggle} side="bottom">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={() => setOpen((v) => !v)}
                    aria-pressed={open}
                    aria-label={labels.toggle}
                >
                    <Library />
                </button>
            </Tooltip>
            {open && (
                <aside
                    className={`bk-library-panel ${className ?? ''}`.trim()}
                    aria-label={labels.title}
                    style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0 }}
                >
                    <header className="bk-library-header">
                        <span style={{ fontWeight: 600 }}>{labels.title}</span>
                        <Tooltip label={labels.close} side="bottom">
                            <button type="button" className="bk-icon-btn" onClick={() => setOpen(false)} aria-label={labels.close}>
                                <X />
                            </button>
                        </Tooltip>
                    </header>
                    {notice}
                    {!readOnly && (
                        <label className="bk-library-import">
                            <Plus size={14} />
                            <span>{labels.importFile}</span>
                            <input
                                type="file"
                                accept=".excalidrawlib,application/json"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFile(f);
                                    e.target.value = '';
                                }}
                                style={{ display: 'none' }}
                            />
                        </label>
                    )}
                    {libraries.length === 0 && (
                        <p style={{ color: 'var(--bk-text-muted)', fontSize: 12, margin: '8px 0' }}>
                            {labels.empty}
                        </p>
                    )}
                    {libraries.map((lib, i) => (
                        <section key={`${lib.addedAt}-${i}`} className="bk-library-section">
                            <div className="bk-library-section-header">
                                <span>{lib.name}</span>
                                {!readOnly && (
                                    <Tooltip label={labels.remove(lib.name)} side="left">
                                        <button
                                            type="button"
                                            className="bk-icon-btn"
                                            onClick={() => update((prev) => prev.filter((_, idx) => idx !== i))}
                                            aria-label={labels.remove(lib.name)}
                                            style={{ width: 22, height: 22 }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                            <div className="bk-library-grid">
                                {lib.items.map((item) => (
                                    <Tooltip key={item.id} label={labels.insert(item.name)} side="top">
                                        <button
                                            type="button"
                                            className="bk-library-item"
                                            disabled={insertDisabled}
                                            onClick={() => insertItem(item)}
                                        >
                                            {item.name}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        </section>
                    ))}
                </aside>
            )}
        </div>
    );
}

/**
 * Inserts a library item centred on `center` (world coordinates) on the
 * active page as one undoable step, queues it for persistence and selects
 * it. Returns the new element ids.
 */
export function insertLibraryItem(store: BoardStore, item: ParsedLibraryItem, center: { x: number; y: number }): string[] {
    const state = store.getState();
    const pageId = state.activePageId ?? '';
    const offsetX = center.x - item.bounds.width / 2;
    const offsetY = center.y - item.bounds.height / 2;
    const now = new Date().toISOString();
    const stamp = Date.now();
    const newIds: string[] = [];
    const mutations: ElementMutation[] = [];

    for (const partial of item.elements) {
        const id = `lib-${stamp}-${newIds.length}-${Math.random().toString(36).slice(2, 7)}`;
        const data: any = JSON.parse(JSON.stringify(partial.data));
        if (data.position) data.position = { x: data.position.x + offsetX, y: data.position.y + offsetY };
        if (Array.isArray(data.points)) data.points = data.points.map((p: any) => ({ x: p.x + offsetX, y: p.y + offsetY }));
        if (data.bounds) data.bounds = { ...data.bounds, x: data.bounds.x + offsetX, y: data.bounds.y + offsetY };
        const el: Element = {
            ...partial,
            id,
            pageId,
            createdBy: '',
            createdAt: now,
            updatedAt: now,
            zIndex: stamp + newIds.length,
            data,
        } as Element;
        newIds.push(id);
        mutations.push({ type: 'create', elementId: id, pageId, data: el, timestamp: stamp });
    }
    if (mutations.length === 0) return newIds;

    store.getState().history.push({
        execute: () => mutations.map((m) => ({ ...m, timestamp: Date.now() })),
        undo: () => mutations.map((m) => ({ type: 'delete', elementId: m.elementId, pageId: m.pageId, timestamp: Date.now() })),
    });
    store.updateScene((scene) => mutations.reduce((s, m) => (
        m.type === 'create' ? addElement(s, m.data as Element) : m.type === 'delete' ? removeElement(s, m.elementId) : updateElement(s, m.elementId, m.data ?? {})
    ), scene));
    store.enqueueOutboundMutations(mutations);
    store.setSelection(new Set(newIds));
    return newIds;
}

function loadLibraries(): LibraryPanelLibrary[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}
