import { useState, useEffect, useCallback } from 'react';
import type { Page } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UsePageNavigationResult {
    pages: Page[];
    activePage: Page | null;
    switchPage: (pageId: string) => void;
    addPage: () => void;
    deletePage: (pageId: string) => void;
    reorderPages: (pageIds: string[]) => void;
}

export function usePageNavigation(): UsePageNavigationResult {
    const { store } = useBoardKit();
    const [pages, setPages] = useState(store.getState().pages);
    const [activePageId, setActivePageId] = useState(
        store.getState().activePageId,
    );

    useEffect(() => {
        return store.subscribe('pages', () => {
            setPages(store.getState().pages);
            setActivePageId(store.getState().activePageId);
        });
    }, [store]);

    const activePage =
        pages.find((p) => p.id === activePageId) ?? null;

    const switchPage = useCallback(
        (pageId: string) => {
            store.setActivePageId(pageId);
        },
        [store],
    );

    const addPage = useCallback(() => {
        const now = new Date().toISOString();
        const newPage: Page = {
            id: `page-${Date.now()}`,
            boardId: store.getState().board?.id ?? '',
            name: `Page ${pages.length + 1}`,
            order: pages.length,
            createdAt: now,
            updatedAt: now,
        };
        store.setPages([...pages, newPage]);
        store.setActivePageId(newPage.id);
    }, [store, pages]);

    const deletePage = useCallback(
        (pageId: string) => {
            const remaining = pages.filter((p) => p.id !== pageId);
            store.setPages(remaining);
            if (activePageId === pageId && remaining.length > 0) {
                store.setActivePageId(remaining[0].id);
            }
        },
        [store, pages, activePageId],
    );

    const reorderPages = useCallback(
        (pageIds: string[]) => {
            const reordered = pageIds
                .map((id) => pages.find((p) => p.id === id))
                .filter((p): p is Page => p !== undefined)
                .map((p, i) => ({ ...p, order: i }));
            store.setPages(reordered);
        },
        [store, pages],
    );

    return {
        pages,
        activePage,
        switchPage,
        addPage,
        deletePage,
        reorderPages,
    };
}
