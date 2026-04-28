import React, { useCallback, useEffect, useState } from 'react';
import { Library, X, Plus } from 'lucide-react';
import type { Element, ElementMutation } from '@hfu.digital/boardkit-core';
import { addElement } from '@hfu.digital/boardkit-core';
import { parseExcalidrawLib, type ParsedLibrary, type ParsedLibraryItem } from '../lib/excalidrawlib-parser';
import { useBoardKit } from '../context/BoardKitProvider';
import { Tooltip } from './Tooltip';

const STORAGE_KEY = 'bk-library:v1';

export interface LibraryPanelProps {
    className?: string;
}

interface StoredLibrary {
    name: string;
    items: ParsedLibraryItem[];
    addedAt: string;
}

/**
 * Slide-in library panel anchored top-right by the consumer. Imports
 * .excalidrawlib JSON files (drag from the OS file picker) and renders
 * each library item as a clickable card. Click → drop the item at the
 * viewport center and select the new elements.
 *
 * Libraries persist in localStorage (no server-side storage in v1 per
 * the rework plan).
 */
export function LibraryPanel({ className }: LibraryPanelProps) {
    const { store } = useBoardKit();
    const [open, setOpen] = useState(false);
    const [libraries, setLibraries] = useState<StoredLibrary[]>(() => loadLibraries());

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
        } catch {
            // localStorage may be unavailable in some sandboxes — fail silently.
        }
    }, [libraries]);

    const handleFile = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const parsed: ParsedLibrary = parseExcalidrawLib(JSON.parse(text), file.name.replace(/\.excalidrawlib$/i, ''));
            setLibraries((prev) => [...prev, { name: parsed.name, items: parsed.items, addedAt: new Date().toISOString() }]);
        } catch (err) {
            alert(`Failed to import library: ${(err as Error).message}`);
        }
    }, []);

    const insertItem = useCallback((item: ParsedLibraryItem) => {
        const state = store.getState();
        const pageId = state.activePageId ?? '';
        // Drop at viewport center.
        const cx = (window.innerWidth / 2 - state.viewport.offset.x) / state.viewport.zoom;
        const cy = (window.innerHeight / 2 - state.viewport.offset.y) / state.viewport.zoom;
        const offsetX = cx - item.bounds.width / 2;
        const offsetY = cy - item.bounds.height / 2;
        const now = new Date().toISOString();
        const newIds: string[] = [];
        const mutations: ElementMutation[] = [];

        store.updateScene((scene) => {
            let s = scene;
            for (const partial of item.elements) {
                const id = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
                    zIndex: Date.now() + newIds.length,
                    data,
                } as Element;
                s = addElement(s, el);
                newIds.push(id);
                mutations.push({
                    type: 'create',
                    elementId: id,
                    pageId,
                    data: el,
                    timestamp: Date.now(),
                });
            }
            return s;
        });
        store.enqueueOutboundMutations(mutations);
        store.setSelection(new Set(newIds));
    }, [store]);

    return (
        <>
            <Tooltip label="Library" side="bottom">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={() => setOpen((v) => !v)}
                    aria-pressed={open}
                    aria-label="Toggle library"
                >
                    <Library />
                </button>
            </Tooltip>
            {open && (
                <aside className={`bk-library-panel ${className ?? ''}`.trim()} aria-label="Library">
                    <header className="bk-library-header">
                        <span style={{ fontWeight: 600 }}>Library</span>
                        <Tooltip label="Close library" side="bottom">
                            <button type="button" className="bk-icon-btn" onClick={() => setOpen(false)} aria-label="Close library">
                                <X />
                            </button>
                        </Tooltip>
                    </header>
                    <label className="bk-library-import">
                        <Plus size={14} />
                        <span>Import .excalidrawlib</span>
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
                    {libraries.length === 0 && (
                        <p style={{ color: 'var(--bk-text-muted)', fontSize: 12, margin: '8px 0' }}>
                            No libraries yet. Import an .excalidrawlib file to get started.
                        </p>
                    )}
                    {libraries.map((lib, i) => (
                        <section key={i} className="bk-library-section">
                            <div className="bk-library-section-header">
                                <span>{lib.name}</span>
                                <Tooltip label={`Remove ${lib.name}`} side="left">
                                    <button
                                        type="button"
                                        className="bk-icon-btn"
                                        onClick={() => setLibraries((prev) => prev.filter((_, idx) => idx !== i))}
                                        aria-label={`Remove ${lib.name}`}
                                        style={{ width: 22, height: 22 }}
                                    >
                                        <X size={12} />
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="bk-library-grid">
                                {lib.items.map((item) => (
                                    <Tooltip key={item.id} label={`Insert ${item.name}`} side="top">
                                        <button
                                            type="button"
                                            className="bk-library-item"
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
        </>
    );
}

function loadLibraries(): StoredLibrary[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}
