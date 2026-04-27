import React, { useEffect, useRef, useState } from 'react';
import { Menu, Sun, Moon, Monitor, Download, Settings, BookOpen, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

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
 * Top-left dropdown menu (Excalidraw's "hamburger") with theme picker,
 * export, help, and settings. The button shows the theme icon when a
 * non-default theme is active so users can see at a glance what mode
 * they're in.
 */
export function HamburgerMenu({ className, onExportClick, onHelpClick, onSettingsClick }: HamburgerMenuProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { theme, setTheme } = useTheme();

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
                    {(onExportClick || onHelpClick || onSettingsClick) && <div className="bk-context-divider" aria-hidden="true" />}
                    <div className="bk-context-item" style={{ display: 'block' }}>
                        <div style={{ marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bk-text-muted)' }}>
                            Theme
                        </div>
                        <div className="bk-control-row" role="radiogroup" aria-label="Theme">
                            <button
                                type="button"
                                className="bk-control-btn"
                                aria-pressed={theme === 'light'}
                                data-selected={theme === 'light'}
                                onClick={() => setTheme('light')}
                                title="Light"
                            >
                                <Sun size={14} />
                            </button>
                            <button
                                type="button"
                                className="bk-control-btn"
                                aria-pressed={theme === 'dark'}
                                data-selected={theme === 'dark'}
                                onClick={() => setTheme('dark')}
                                title="Dark"
                            >
                                <Moon size={14} />
                            </button>
                            <button
                                type="button"
                                className="bk-control-btn"
                                aria-pressed={theme === 'system'}
                                data-selected={theme === 'system'}
                                onClick={() => setTheme('system')}
                                title="Follow system"
                            >
                                <Monitor size={14} />
                            </button>
                        </div>
                    </div>
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
