import React, { useRef, useEffect } from 'react';
import type { InputEvent as CoreInputEvent } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';
import { InputPipeline } from '../engine/input-pipeline';
import { zoomToPoint } from '../engine/viewport';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export interface BoardCanvasProps {
    boardId: string;
    className?: string;
    style?: React.CSSProperties;
    readOnly?: boolean;
}

export function BoardCanvas({
    boardId,
    className,
    style,
    readOnly = false,
}: BoardCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pipelineRef = useRef<InputPipeline | null>(null);
    const { store, renderer, toolRegistry } = useBoardKit();

    useKeyboardShortcuts();

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
                            }
                        }
                        return s;
                    });
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

    return (
        <div
            ref={containerRef}
            className={className}
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
