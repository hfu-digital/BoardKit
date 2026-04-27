import { useEffect, useState, useCallback } from 'react';

export type BoardKitThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'bk-theme:v1';

function readPreferred(): BoardKitThemeMode {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* sandbox */ }
    return 'system';
}

function applyToDom(t: BoardKitThemeMode): void {
    if (typeof document === 'undefined') return;
    // Apply on the BoardKitProvider's wrapper if present, otherwise <html>.
    const target = document.querySelector('[data-bk-root]') as HTMLElement | null
        ?? document.documentElement;
    if (t === 'system') {
        target.removeAttribute('data-bk-theme');
    } else {
        target.setAttribute('data-bk-theme', t);
    }
}

export interface UseThemeResult {
    theme: BoardKitThemeMode;
    /** The resolved theme (light or dark) — what's actually rendered after `system` resolves to OS preference. */
    resolvedTheme: 'light' | 'dark';
    setTheme: (next: BoardKitThemeMode) => void;
}

/**
 * Theme switcher. Persists user pick (light / dark / system) to
 * localStorage. `system` defers to prefers-color-scheme so the whiteboard
 * follows OS theme without explicit opt-in.
 */
export function useTheme(): UseThemeResult {
    const [theme, setThemeState] = useState<BoardKitThemeMode>(() => readPreferred());
    const [systemDark, setSystemDark] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        applyToDom(theme);
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const setTheme = useCallback((next: BoardKitThemeMode) => {
        setThemeState(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* sandbox */ }
    }, []);

    const resolvedTheme: 'light' | 'dark' =
        theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

    return { theme, resolvedTheme, setTheme };
}
