import { useState, useEffect, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseHistoryResult {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export function useHistory(): UseHistoryResult {
    const { store } = useBoardKit();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const updateState = useCallback(() => {
        const { history } = store.getState();
        setCanUndo(history.canUndo());
        setCanRedo(history.canRedo());
    }, [store]);

    useEffect(() => {
        return store.subscribe('scene', updateState);
    }, [store, updateState]);

    const undo = useCallback(() => {
        const { history } = store.getState();
        const mutations = history.undo();
        if (mutations) {
            // Apply undo mutations to scene
            // Scene update will trigger re-render
            store.updateScene((scene) => {
                // Mutations are applied by the store layer
                return scene;
            });
        }
    }, [store]);

    const redo = useCallback(() => {
        const { history } = store.getState();
        const mutations = history.redo();
        if (mutations) {
            store.updateScene((scene) => {
                return scene;
            });
        }
    }, [store]);

    return { undo, redo, canUndo, canRedo };
}
