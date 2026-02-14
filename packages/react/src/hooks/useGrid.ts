import { useCallback, useSyncExternalStore } from 'react';
import type { GridConfig } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseGridResult {
    gridConfig: GridConfig;
    toggleGrid: () => void;
    toggleSnap: () => void;
    setGridSize: (size: number) => void;
}

export function useGrid(): UseGridResult {
    const { store } = useBoardKit();

    const gridConfig = useSyncExternalStore(
        (cb) => store.subscribe('grid', cb),
        () => store.getState().gridConfig,
    );

    const toggleGrid = useCallback(() => {
        const current = store.getState().gridConfig;
        store.setGridConfig({
            enabled: !current.enabled,
            visible: !current.enabled, // show grid when enabled
        });
    }, [store]);

    const toggleSnap = useCallback(() => {
        const current = store.getState().gridConfig;
        store.setGridConfig({ snapEnabled: !current.snapEnabled });
    }, [store]);

    const setGridSize = useCallback((size: number) => {
        store.setGridConfig({ size });
    }, [store]);

    return { gridConfig, toggleGrid, toggleSnap, setGridSize };
}
