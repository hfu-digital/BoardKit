import { useState, useEffect, useCallback } from 'react';
import type { Page } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UsePageNavigationResult {
    pages: Page[];
    activePage: Page | null;
    switchPage: (pageId: string) => void;
    addPage: (name?: string) => Promise<Page>;
    deletePage: (pageId: string) => Promise<void>;
    renamePage: (pageId: string, name: string) => Promise<void>;
    reorderPages: (pageIds: string[]) => Promise<void>;
    pending: boolean;
    error: string | null;
}

export function usePageNavigation(): UsePageNavigationResult {
    const { store, config } = useBoardKit();
    const [, render] = useState(0);
    const [count, setCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => store.subscribe('pages', () => render(n => n + 1)), [store]);
    const request = useCallback(async (path: string, method: string, body?: unknown) => {
        const boardId = store.getState().board?.id;
        if (!boardId) throw new Error('Board is not loaded');
        setCount(n => n + 1); setError(null);
        try {
            const res = await fetch(`${config.apiUrl}/boards/${boardId}/pages${path}`, {
                method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.authToken ?? ''}` },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Page operation failed: ${res.status}`);
            const result = await res.json();
            if (store.getState().board?.id !== boardId) throw new Error('Board changed during operation');
            return result;
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); throw e; }
        finally { setCount(n => n - 1); }
    }, [store, config.apiUrl, config.authToken]);
    const pages = store.getState().pages;
    return {
        pages, activePage: pages.find(p => p.id === store.getState().activePageId) ?? null,
        pending: count > 0, error,
        switchPage: id => store.setActivePageId(id),
        addPage: async name => {
            const page: Page = await request('', 'POST', { name });
            store.setPages([...store.getState().pages.filter(p => p.id !== page.id), page]);
            store.setActivePageId(page.id); return page;
        },
        renamePage: async (id, name) => {
            const page: Page = await request(`/${encodeURIComponent(id)}`, 'PATCH', { name });
            store.setPages(store.getState().pages.map(p => p.id === id ? page : p));
        },
        deletePage: async id => {
            await request(`/${encodeURIComponent(id)}`, 'DELETE');
            store.setPages(store.getState().pages.filter(p => p.id !== id));
        },
        reorderPages: async pageIds => { store.setPages(await request('', 'PATCH', { pageIds })); },
    };
}
