import { useState, useEffect, useCallback } from 'react';
import type { Board, Page } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseBoardResult {
    board: Board | null;
    pages: Page[];
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export function useBoard(boardId: string): UseBoardResult {
    const { store, config } = useBoardKit();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [board, setBoard] = useState<Board | null>(null);
    const [pages, setPages] = useState<Page[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${config.apiUrl}/boards/${boardId}`, {
                headers: config.authToken
                    ? { Authorization: `Bearer ${config.authToken}` }
                    : {},
            });
            if (!res.ok) throw new Error(`Failed to load board: ${res.status}`);
            const data = await res.json();
            setBoard(data);
            setPages(data.pages ?? []);
            store.setBoard(data);
            store.setPages(data.pages ?? []);
            if (data.pages?.length > 0) {
                store.setActivePageId(data.pages[0].id);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [boardId, config.apiUrl, config.authToken, store]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const unsubBoard = store.subscribe('board', () => {
            setBoard(store.getState().board);
        });
        const unsubPages = store.subscribe('pages', () => {
            setPages(store.getState().pages);
        });
        return () => {
            unsubBoard();
            unsubPages();
        };
    }, [store]);

    return { board, pages, loading, error, reload: load };
}
