import React, { useEffect, useRef, useState } from 'react';
import { Menu, Download, Settings, BookOpen, ChevronRight } from 'lucide-react';

export interface HamburgerMenuProps {
    className?: string;
    /** Called when user clicks "Export image…" — wire to ExportDialog. */
    onExportClick?: () => void;
    /** Called when user clicks "Help" — wire to OnboardingTour open prop. */
    onHelpClick?: () => void;
    /** Called when user clicks "Settings" — wire to a consumer-defined settings dialog. */
    onSettingsClick?: () => void;
}

/**
 * Top-left dropdown menu (Excalidraw's "hamburger") with export, help, and
 * settings entries. The theme picker was removed in 2026.04.9 — the canvas
 * follows the consumer app's theme via [data-bk-theme] (and BoardKit's
 * useTheme hook is still exported for apps that want their own picker).
 */
export function HamburgerMenu({ className, onExportClick, onHelpClick, onSettingsClick }: HamburgerMenuProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click / Esc.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('mousedown', onDoc);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDoc);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className={`bk-hamburger ${className ?? ''}`.trim()}>
            <button
                type="button"
                className="bk-icon-btn bk-pill"
                style={{ width: 40, height: 40 }}
                onClick={() => setOpen((v) => !v)}
                aria-pressed={open}
                aria-label="Open menu"
                title="Menu"
            >
                <Menu />
            </button>
            {open && (
                <div className="bk-context-menu" role="menu" style={{ position: 'absolute', marginTop: 6 }}>
                    {onExportClick && (
                        <Item icon={<Download size={14} />} label="Export image…" onClick={() => { onExportClick(); setOpen(false); }} />
                    )}
                    {onHelpClick && (
                        <Item icon={<BookOpen size={14} />} label="Help / Tour" onClick={() => { onHelpClick(); setOpen(false); }} />
                    )}
                    {onSettingsClick && (
                        <Item icon={<Settings size={14} />} label="Settings" onClick={() => { onSettingsClick(); setOpen(false); }} />
                    )}
                </div>
            )}
        </div>
    );
}

function Item({ icon, label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <div className="bk-context-item" role="menuitem" onClick={onClick}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {icon}
                {label}
            </span>
            <ChevronRight size={12} style={{ opacity: 0.4 }} />
        </div>
    );
}
