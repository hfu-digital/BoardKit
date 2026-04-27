import React, { useMemo } from 'react';
import type { ContextMenuState } from '../hooks/useContextMenu';
import { useSelection } from '../hooks/useSelection';
import { useElementMutations } from '../hooks/useElementMutations';

export interface ContextMenuProps {
    state: ContextMenuState;
    onClose: () => void;
    /** Optional extra items appended at the bottom (e.g. "Link to URL"). */
    extra?: React.ReactNode;
}

/**
 * Right-click context menu. Renders an element-mode menu (when right-clicking
 * a selected element) or a canvas-mode menu (empty canvas). Anchors to the
 * click position; the consumer supplies a wrapper that handles z-index.
 */
export function ContextMenu({ state, onClose, extra }: ContextMenuProps) {
    const { selectedIds, selectedElements } = useSelection();
    const { duplicateElements, deleteElements, reorderElements } = useElementMutations();

    // Snap menu within viewport to avoid overflow on right edge / bottom edge.
    const style = useMemo<React.CSSProperties>(() => {
        const width = 200;
        const height = 320;
        const left = Math.min(state.x, window.innerWidth - width - 8);
        const top = Math.min(state.y, window.innerHeight - height - 8);
        return { left, top };
    }, [state.x, state.y]);

    if (!state.open) return null;

    const ids = Array.from(selectedIds);
    const isEmptyCanvas = ids.length === 0;
    const isLocked = !isEmptyCanvas && Boolean((selectedElements[0] as any).lockedBy);

    const wrap = (fn: () => void) => () => { fn(); onClose(); };

    return (
        <div className="bk-context-menu" style={style} role="menu" onContextMenu={(e) => e.preventDefault()}>
            {isEmptyCanvas ? (
                <>
                    <Item label="Paste" shortcut="Ctrl+V" onClick={wrap(() => {
                        // Defer to keyboard shortcut handler — programmatically
                        // dispatching keyboard events isn't reliable. Tell user.
                        alert('Use Ctrl+V to paste from clipboard.');
                    })} />
                    <Item label="Select all" shortcut="Ctrl+A" onClick={wrap(() => {
                        // Same: defer to keyboard shortcut.
                        alert('Use Ctrl+A to select everything.');
                    })} />
                </>
            ) : (
                <>
                    <Item label="Duplicate" shortcut="Ctrl+D" onClick={wrap(() => duplicateElements(ids))} />
                    <Item label="Copy" shortcut="Ctrl+C" onClick={wrap(() => {
                        alert('Use Ctrl+C to copy.');
                    })} />
                    <Item label="Cut" shortcut="Ctrl+X" onClick={wrap(() => {
                        alert('Use Ctrl+X to cut.');
                    })} />
                    <Divider />
                    <Item label="Bring to front" onClick={wrap(() => reorderElements(ids, 'front'))} />
                    <Item label="Bring forward" onClick={wrap(() => reorderElements(ids, 'forward'))} />
                    <Item label="Send backward" onClick={wrap(() => reorderElements(ids, 'backward'))} />
                    <Item label="Send to back" onClick={wrap(() => reorderElements(ids, 'back'))} />
                    <Divider />
                    <Item label="Group" shortcut="Ctrl+G" disabled onClick={wrap(() => {})} />
                    <Item label="Ungroup" shortcut="Ctrl+Shift+G" disabled onClick={wrap(() => {})} />
                    <Item label={isLocked ? 'Unlock' : 'Lock'} disabled onClick={wrap(() => {})} />
                    <Item label="Add link" disabled onClick={wrap(() => {})} />
                    <Divider />
                    <Item label="Delete" shortcut="Del" onClick={wrap(() => deleteElements(ids))} />
                </>
            )}
            {extra}
        </div>
    );
}

function Item({
    label,
    shortcut,
    onClick,
    disabled,
}: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <div
            className="bk-context-item"
            role="menuitem"
            aria-disabled={disabled}
            {...(disabled ? { } : { onMouseDown: (e: React.MouseEvent) => e.stopPropagation(), onClick })}
            {...(disabled ? { 'data-disabled': '' } : {})}
            style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
            <span>{label}</span>
            {shortcut && <span className="bk-context-shortcut">{shortcut}</span>}
        </div>
    );
}

function Divider() {
    return <div className="bk-context-divider" aria-hidden="true" />;
}
