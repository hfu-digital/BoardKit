import { useState, useEffect, useCallback, useRef } from 'react';
import type { Board, Page, Element } from '@hfu.digital/boardkit-core';
import { hydrateScene } from '../store/scene-sync';
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

    const generation = useRef(0);
    const load = useCallback(async () => {
        const version = ++generation.current;
        const wasHydrated = store.getState().isHydrated;
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
            const pageList: Page[] = data.pages ?? [];
            const entries = await Promise.all(pageList.map(async page => {
                const response = await fetch(`${config.apiUrl}/boards/${boardId}/pages/${page.id}/elements`, { headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {} });
                if (!response.ok) throw new Error(`Failed to load page: ${response.status}`);
                return [page.id, await response.json() as Element[]] as const;
            }));
            if (version !== generation.current) return;
            // Socket sync owns the live scene. An HTTP read started before it must not overwrite it.
            if (!config.wsUrl && (!store.getState().isHydrated || wasHydrated)) hydrateScene(store, { board: data, pages: pageList, elements: Object.fromEntries(entries) });
            else if (!store.getState().isHydrated) { store.setBoard(data); store.setPages(pageList); }
        } catch (e) {
            if (version !== generation.current) return;
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            if (version === generation.current) setLoading(false);
        }
    }, [boardId, config.apiUrl, config.authToken, config.wsUrl, store]);

    useEffect(() => {
        load();
        return () => { generation.current++; };
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
