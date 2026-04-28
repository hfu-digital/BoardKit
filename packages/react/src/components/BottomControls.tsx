import React from 'react';
import { Minus, Plus, Undo, Redo, HelpCircle, FilePlus, X } from 'lucide-react';
import { useViewport } from '../hooks/useViewport';
import { useHistory } from '../hooks/useHistory';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { Tooltip } from './Tooltip';

export interface BottomControlsProps {
    className?: string;
    /**
     * Optional handler for the help (?) button. If omitted, the button is
     * hidden — M5 wires this to the OnboardingTour.
     */
    onHelpClick?: () => void;
    /** Hide the page navigator subsection. */
    hidePages?: boolean;
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/**
 * Excalidraw-style bottom-left bar: zoom in/out + reset, undo/redo,
 * page nav, and a help shortcut. Each subsection is its own .bk-bottom-bar
 * pill so consumers can split them across the viewport if they want.
 */
export function BottomControls({ className, onHelpClick, hidePages }: BottomControlsProps) {
    const { viewport, zoomTo, resetZoom } = useViewport();
    const { undo, redo, canUndo, canRedo } = useHistory();
    const { pages, activePage, switchPage, addPage, deletePage } = usePageNavigation();
    const activePageId = activePage?.id ?? null;

    const stepZoom = (dir: -1 | 1) => {
        const idx = nearestStep(viewport.zoom);
        const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir))];
        zoomTo(next);
    };

    return (
        <div
            className={`bk-bottom-bar ${className ?? ''}`.trim()}
            role="toolbar"
            aria-label="Canvas controls"
        >
            <Tooltip label="Zoom out" shortcut="Ctrl+−" side="top">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={() => stepZoom(-1)}
                    aria-label="Zoom out"
                >
                    <Minus />
                </button>
            </Tooltip>
            <Tooltip label="Reset zoom" shortcut="Ctrl+0" side="top">
                <button
                    type="button"
                    className="bk-zoom-display"
                    onClick={resetZoom}
                    aria-label="Reset zoom to 100%"
                >
                    {Math.round(viewport.zoom * 100)}%
                </button>
            </Tooltip>
            <Tooltip label="Zoom in" shortcut="Ctrl+=" side="top">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={() => stepZoom(1)}
                    aria-label="Zoom in"
                >
                    <Plus />
                </button>
            </Tooltip>
            <span className="bk-divider" aria-hidden="true" />
            <Tooltip label="Undo" shortcut="Ctrl+Z" side="top">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                >
                    <Undo />
                </button>
            </Tooltip>
            <Tooltip label="Redo" shortcut="Ctrl+Y" side="top">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                >
                    <Redo />
                </button>
            </Tooltip>
            {!hidePages && pages.length > 0 && (
                <>
                    <span className="bk-divider" aria-hidden="true" />
                    <PageNav
                        pages={pages}
                        activePageId={activePageId}
                        onSwitch={switchPage}
                        onAdd={addPage}
                        onDelete={deletePage}
                    />
                </>
            )}
            {onHelpClick && (
                <>
                    <span className="bk-divider" aria-hidden="true" />
                    <Tooltip label="Help" shortcut="?" side="top">
                        <button
                            type="button"
                            className="bk-icon-btn"
                            onClick={onHelpClick}
                            aria-label="Open help"
                        >
                            <HelpCircle />
                        </button>
                    </Tooltip>
                </>
            )}
        </div>
    );
}

function nearestStep(zoom: number): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
        const d = Math.abs(ZOOM_STEPS[i] - zoom);
        if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function PageNav({
    pages,
    activePageId,
    onSwitch,
    onAdd,
    onDelete,
}: {
    pages: { id: string; name: string }[];
    activePageId: string | null;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div role="group" aria-label="Pages" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {pages.map((page, idx) => {
                const isActive = page.id === activePageId;
                return (
                    <span key={page.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Tooltip label={page.name} side="top">
                            <button
                                type="button"
                                className="bk-control-btn"
                                data-selected={isActive}
                                aria-pressed={isActive}
                                onClick={() => onSwitch(page.id)}
                                style={{ minHeight: 28, paddingRight: pages.length > 1 ? 4 : 8 }}
                            >
                                {idx + 1}
                            </button>
                        </Tooltip>
                        {pages.length > 1 && (
                            <Tooltip label={`Delete ${page.name}`} side="top">
                                <button
                                    type="button"
                                    className="bk-icon-btn"
                                    style={{ width: 22, height: 22 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete page "${page.name}"?`)) onDelete(page.id);
                                    }}
                                    aria-label={`Delete page ${page.name}`}
                                >
                                    <X size={12} />
                                </button>
                            </Tooltip>
                        )}
                    </span>
                );
            })}
            <Tooltip label="Add page" side="top">
                <button
                    type="button"
                    className="bk-icon-btn"
                    onClick={onAdd}
                    aria-label="Add page"
                >
                    <FilePlus />
                </button>
            </Tooltip>
        </div>
    );
}
