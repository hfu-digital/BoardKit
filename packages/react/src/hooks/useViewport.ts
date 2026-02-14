import { useState, useEffect, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';
import type { ViewportState } from '../engine/viewport';
import { zoomToPoint, MIN_ZOOM, MAX_ZOOM } from '../engine/viewport';

export interface UseViewportResult {
    viewport: ViewportState;
    panTo: (x: number, y: number) => void;
    zoomTo: (zoom: number) => void;
    fitToContent: () => void;
    resetZoom: () => void;
}

export function useViewport(): UseViewportResult {
    const { store } = useBoardKit();
    const [viewport, setViewport] = useState(store.getState().viewport);

    useEffect(() => {
        return store.subscribe('viewport', () => {
            setViewport(store.getState().viewport);
        });
    }, [store]);

    const panTo = useCallback(
        (x: number, y: number) => {
            store.updateViewport((vp) => ({
                ...vp,
                offset: { x, y },
            }));
        },
        [store],
    );

    const zoomTo = useCallback(
        (zoom: number) => {
            const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
            store.updateViewport((vp) => ({
                ...vp,
                zoom: clamped,
            }));
        },
        [store],
    );

    const fitToContent = useCallback(() => {
        const { scene } = store.getState();
        if (scene.elements.size === 0) return;

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const el of scene.elements.values()) {
            if ('bounds' in el.data) {
                const b = el.data.bounds;
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
            }
        }

        if (!isFinite(minX)) return;

        const padding = 50;
        const contentW = maxX - minX + padding * 2;
        const contentH = maxY - minY + padding * 2;

        // Assume container size from renderer
        const zoom = Math.min(
            800 / contentW,
            600 / contentH,
            MAX_ZOOM,
        );

        store.updateViewport(() => ({
            zoom: Math.max(MIN_ZOOM, zoom),
            offset: {
                x: -(minX - padding) * zoom,
                y: -(minY - padding) * zoom,
            },
        }));
    }, [store]);

    const resetZoom = useCallback(() => {
        store.updateViewport(() => ({
            zoom: 1,
            offset: { x: 0, y: 0 },
        }));
    }, [store]);

    return { viewport, panTo, zoomTo, fitToContent, resetZoom };
}
