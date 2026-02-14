import { useState, useEffect, useCallback, useRef } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';
import type { BoardError } from '../store/board-store';

export type { BoardError } from '../store/board-store';

export interface UseErrorRecoveryResult {
    lastError: BoardError | null;
    clearError: () => void;
    isRecovering: boolean;
}

export function useErrorRecovery(): UseErrorRecoveryResult {
    const { store } = useBoardKit();
    const [lastError, setLastError] = useState<BoardError | null>(null);
    const [isRecovering, setIsRecovering] = useState(false);
    const sessionIdRef = useRef<string | null>(null);

    // Generate a session ID on mount
    useEffect(() => {
        sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }, []);

    // Subscribe to error slice changes on the store
    useEffect(() => {
        const unsubscribe = store.subscribe('error', () => {
            const { lastError: storeError } = store.getState();
            setLastError(storeError);

            if (storeError && !storeError.recoverable) {
                setIsRecovering(true);
            }
        });

        return unsubscribe;
    }, [store]);

    // Handle concurrent page deletion:
    // When a mutation targets a deleted page, discard it silently and clear selection
    useEffect(() => {
        const unsubscribe = store.subscribe('scene', () => {
            const { activePageId, pages, selectedIds, scene } = store.getState();

            // Check if the active page still exists
            if (activePageId && pages.length > 0) {
                const pageExists = pages.some((p) => p.id === activePageId);
                if (!pageExists) {
                    // Active page was deleted -- clear selection and switch to first page
                    if (selectedIds.size > 0) {
                        store.setSelection(new Set());
                    }
                    if (pages.length > 0) {
                        store.setActivePageId(pages[0].id);
                    }
                }
            }
        });

        return unsubscribe;
    }, [store]);

    // Handle stale tab detection via session ID
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible again; check if session is stale
                const { lastError: storeError } = store.getState();
                if (
                    storeError &&
                    storeError.code === 'SESSION_MISMATCH'
                ) {
                    setIsRecovering(true);
                    // Trigger a full reload to recover
                    window.location.reload();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [store]);

    const clearError = useCallback(() => {
        store.setError(null);
        setLastError(null);
        setIsRecovering(false);
    }, [store]);

    return { lastError, clearError, isRecovering };
}
