import React from 'react';
import { usePageNavigation } from '../hooks/usePageNavigation';

export interface PageNavigatorProps {
    className?: string;
}

export function PageNavigator({ className }: PageNavigatorProps) {
    const { pages, activePage, switchPage, addPage, deletePage } =
        usePageNavigation();

    return (
        <div className={className} role="tablist" aria-label="Pages">
            {pages.map((page) => (
                <div key={page.id} role="tab" aria-selected={page.id === activePage?.id}>
                    <button onClick={() => switchPage(page.id)}>
                        {page.name}
                    </button>
                    {pages.length > 1 && (
                        <button
                            onClick={() => deletePage(page.id)}
                            aria-label={`Delete ${page.name}`}
                        >
                            x
                        </button>
                    )}
                </div>
            ))}
            <button onClick={addPage} aria-label="Add page">
                +
            </button>
        </div>
    );
}
