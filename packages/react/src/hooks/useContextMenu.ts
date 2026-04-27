import { useEffect, useState, useCallback } from 'react';

export interface ContextMenuState {
    open: boolean;
    /** Screen-space coordinates (clientX/clientY of the right-click). */
    x: number;
    y: number;
    /**
     * Element id under the cursor (or null when right-clicking empty canvas).
     * The menu uses this to switch between element-actions and canvas-actions.
     */
    elementId: string | null;
}

const CLOSED: ContextMenuState = { open: false, x: 0, y: 0, elementId: null };

/**
 * Coordinator for the right-click context menu. The BoardCanvas component
 * wires `onContextMenu` to call `openAt`; the ContextMenu component reads
 * `state` and renders. Esc, click-outside, and any tool action close the menu.
 */
export function useContextMenu() {
    const [state, setState] = useState<ContextMenuState>(CLOSED);
    const close = useCallback(() => setState(CLOSED), []);
    const openAt = useCallback((x: number, y: number, elementId: string | null) => {
        setState({ open: true, x, y, elementId });
    }, []);

    useEffect(() => {
        if (!state.open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        const onClick = (e: MouseEvent) => {
            // Any click outside closes — the menu items handle their own action
            // via stopPropagation, so this only fires on background clicks.
            const target = e.target as HTMLElement;
            if (!target.closest('.bk-context-menu')) close();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('mousedown', onClick);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClick);
        };
    }, [state.open, close]);

    return { state, openAt, close };
}
