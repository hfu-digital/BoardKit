import React, { useRef, useEffect } from 'react';
import type { InputEvent as CoreInputEvent } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';
import { InputPipeline } from '../engine/input-pipeline';
import { zoomToPoint } from '../engine/viewport';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useImageImport } from '../hooks/useImageImport';

export interface BoardCanvasProps {
    boardId: string;
    className?: string;
    style?: React.CSSProperties;
    readOnly?: boolean;
    /**
     * Called on right-click. The consumer typically forwards this to a
     * `useContextMenu` hook to open the ContextMenu at the click location.
     * `elementId` is null for empty-canvas right-clicks.
     */
    onContextMenu?: (event: { clientX: number; clientY: number; elementId: string | null }) => void;
}

export function BoardCanvas({
    boardId,
    className,
    style,
    readOnly = false,
    onContextMenu,
}: BoardCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pipelineRef = useRef<InputPipeline | null>(null);
    const { store, renderer, toolRegistry, config } = useBoardKit();

    useKeyboardShortcuts();

    // Tools cache pageId + createdBy as instance state and stamp them on
    // every element they create. Without an explicit set, currentPageId
    // stays empty string — elements get persisted with pageId='' and the
    // server can never associate them back to a page on reload, so the
    // board appears not to save. Re-sync on any pages-slice change (active
    // page switch, page rename) AND on userId change.
    useEffect(() => {
        const sync = () => {
            const pageId = store.getState().activePageId ?? '';
            const userId = config.userId ?? '';
            for (const tool of toolRegistry.getAll()) {
                const t = tool as { setPageId?: (id: string) => void; setCreatedBy?: (id: string) => void };
                t.setPageId?.(pageId);
                t.setCreatedBy?.(userId);
            }
        };
        sync();
        return store.subscribe('pages', sync);
    }, [store, toolRegistry, config.userId]);
    // Hosted inside BoardCanvas so drag-drop + paste + the file picker work
    // without the consumer wiring useImageImport themselves. When the user
    // selects the Image tool, we open the file picker and snap back to Select
    // so the toolbar doesn't stay in a weird "armed" state.
    const { openFilePicker } = useImageImport(boardId);
    useEffect(() => {
        return store.subscribe('tool', () => {
            if (store.getState().activeTool === 'image') {
                openFilePicker();
                store.setActiveTool('select');
            }
        });
    }, [store, openFilePicker]);

    // Initialize renderer
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        renderer.initialize(container);

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                renderer.resize(width, height);
            }
        });
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            renderer.destroy();
        };
    }, [renderer]);

    // Set up input pipeline
    useEffect(() => {
        const canvas = renderer.getInteractiveCanvas();
        if (!canvas || readOnly) return;

        const pipeline = new InputPipeline(canvas, store.getState().viewport);
        pipelineRef.current = pipeline;

        pipeline.onInput = (event: CoreInputEvent) => {
            const { activeTool } = store.getState();
            const tool = toolRegistry.get(activeTool);
            if (!tool) return;

            let result;
            switch (event.type) {
                case 'pointerDown':
                    result = tool.onPointerDown(event, store.getState().scene);
                    break;
                case 'pointerMove':
                    result = tool.onPointerMove(event, store.getState().scene);
                    break;
                case 'pointerUp':
                    result = tool.onPointerUp(event, store.getState().scene);
                    break;
                case 'pointerCancel':
                    result = tool.onCancel();
                    break;
            }

            if (result) {
                if (result.preview) {
                    renderer.renderInteractiveLayer(
                        result.preview,
                        Array.from(store.getState().cursors.values()),
                        [],
                        {
                            viewport: store.getState().viewport,
                            selectedIds: store.getState().selectedIds,
                            activeTool: store.getState().activeTool,
                        },
                    );
                }
                if (result.mutations && result.mutations.length > 0) {
                    // Apply mutations to scene
                    store.updateScene((scene) => {
                        let s = scene;
                        for (const m of result!.mutations!) {
                            if (m.type === 'create' && m.data) {
                                const elements = new Map(s.elements);
                                elements.set(m.elementId, m.data as any);
                                s = {
                                    elements,
                                    elementOrder: [
                                        ...s.elementOrder,
                                        m.elementId,
                                    ],
                                };
                            } else if (m.type === 'update' && m.data) {
                                const existing = s.elements.get(m.elementId);
                                if (!existing) continue;
                                const elements = new Map(s.elements);
                                elements.set(m.elementId, { ...existing, ...(m.data as any) });
                                s = { elements, elementOrder: s.elementOrder };
                            } else if (m.type === 'delete') {
                                const elements = new Map(s.elements);
                                elements.delete(m.elementId);
                                s = {
                                    elements,
                                    elementOrder: s.elementOrder.filter((id) => id !== m.elementId),
                                };
                            }
                        }
                        return s;
                    });
                    // Enqueue for transmission. The useCollaboration hook subscribes to
                    // the 'outbound' slice and flushes the queue with debouncing — without
                    // this enqueue, mutations stay local and the board never persists.
                    // Drop mutations with empty pageId — those would FK-violate at the
                    // server's upsert. This only happens during the brief window between
                    // mount and useBoard's setActivePageId; the local apply already
                    // persisted the visual.
                    const sendable = result.mutations.filter((m) => m.pageId !== '');
                    if (sendable.length !== result.mutations.length) {
                        console.warn(
                            `BoardCanvas: skipped ${result.mutations.length - sendable.length} mutation(s) with empty pageId — pages not loaded yet`,
                        );
                    }
                    if (sendable.length > 0) {
                        store.enqueueOutboundMutations(sendable);
                    }
                }
                if (result.cursor) {
                    canvas.style.cursor = result.cursor;
                }
            }
        };

        pipeline.onViewportChange = (gesture, delta) => {
            if (gesture === 'pan') {
                const d = delta as { x: number; y: number };
                store.updateViewport((vp) => ({
                    ...vp,
                    offset: {
                        x: vp.offset.x + d.x,
                        y: vp.offset.y + d.y,
                    },
                }));
            } else if (gesture === 'zoom') {
                const zoomDelta = delta as number;
                store.updateViewport((vp) =>
                    zoomToPoint(vp, { x: canvas.width / 2, y: canvas.height / 2 }, zoomDelta),
                );
            }
        };

        pipeline.attach();

        return () => {
            pipeline.detach();
            pipelineRef.current = null;
        };
    }, [renderer, store, toolRegistry, readOnly]);

    // Sync viewport to pipeline
    useEffect(() => {
        return store.subscribe('viewport', () => {
            pipelineRef.current?.updateViewport(store.getState().viewport);
            renderer.invalidateScene();
        });
    }, [store, renderer]);

    // Sync scene to renderer
    useEffect(() => {
        return store.subscribe('scene', () => {
            const state = store.getState();
            const elements = Array.from(state.scene.elements.values());
            renderer.renderStaticLayer(elements, {
                viewport: state.viewport,
                selectedIds: state.selectedIds,
                activeTool: state.activeTool,
            });
        });
    }, [store, renderer]);

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onContextMenu) return;
        e.preventDefault();
        // Hit-test against the topmost element under the cursor in world space.
        // Falls back to canvas-mode (null elementId) on miss.
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return onContextMenu({ clientX: e.clientX, clientY: e.clientY, elementId: null });
        const state = store.getState();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = (screenX - state.viewport.offset.x) / state.viewport.zoom;
        const worldY = (screenY - state.viewport.offset.y) / state.viewport.zoom;
        let hit: string | null = null;
        // Highest zIndex wins (iterate in reverse element order so topmost first).
        for (let i = state.scene.elementOrder.length - 1; i >= 0; i--) {
            const id = state.scene.elementOrder[i];
            const el = state.scene.elements.get(id);
            if (!el || !('bounds' in el.data)) continue;
            const b = el.data.bounds;
            if (worldX >= b.x && worldX <= b.x + b.width && worldY >= b.y && worldY <= b.y + b.height) {
                hit = id;
                break;
            }
        }
        if (hit && !state.selectedIds.has(hit)) {
            store.setSelection(new Set([hit]));
        }
        onContextMenu({ clientX: e.clientX, clientY: e.clientY, elementId: hit });
    };

    return (
        <div
            ref={containerRef}
            className={className}
            onContextMenu={handleContextMenu}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                touchAction: 'none',
                ...style,
            }}
        />
    );
}
