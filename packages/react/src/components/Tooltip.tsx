import React, { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
    /** Main label rendered in the bubble. */
    label: string;
    /** Optional shortcut hint shown after the label in `.bk-shortcut` style (e.g. "V", "Ctrl+Z"). */
    shortcut?: string;
    /** Preferred side. Auto-flips if the bubble would clip the viewport. */
    side?: 'top' | 'bottom' | 'left' | 'right';
    /** Open delay in ms. Default 250. */
    delay?: number;
    /**
     * The trigger element. Must be a single React element that forwards
     * standard DOM events; we attach hover/focus listeners and a ref to it.
     * We strip its `title=` attribute so the OS tooltip doesn't double up.
     */
    children: React.ReactElement;
}

interface Position {
    top: number;
    left: number;
    /** Resolved side after viewport collision. */
    side: 'top' | 'bottom' | 'left' | 'right';
}

const GAP = 6;

/**
 * Lightweight tooltip used across BoardKit chrome. No external deps; reuses
 * the `.bk-tooltip` / `.bk-shortcut` styles. Suppresses on disabled triggers
 * to match Radix' behavior, and strips the underlying `title=` so a styled
 * bubble and the OS tooltip never both appear.
 */
export function Tooltip({ label, shortcut, side = 'top', delay = 250, children }: TooltipProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<Position | null>(null);
    // Resolved at open-time so the bubble portals into the closest [data-bk-root]
    // ancestor of the trigger — that's where the consumer (or useTheme) sets
    // `data-bk-theme`, and CSS variables in tokens.css only cascade to
    // descendants of that attribute. Portaling to document.body would lock
    // tooltips to the `:root` (light) defaults regardless of theme.
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const computePosition = useCallback((): Position | null => {
        const trigger = triggerRef.current;
        const bubble = bubbleRef.current;
        if (!trigger) return null;
        const r = trigger.getBoundingClientRect();
        // Use a sane default size if the bubble hasn't been measured yet.
        const bw = bubble?.offsetWidth ?? 120;
        const bh = bubble?.offsetHeight ?? 28;

        const candidates: Position[] = (() => {
            switch (side) {
                case 'bottom':
                    return [
                        { top: r.bottom + GAP, left: r.left + r.width / 2 - bw / 2, side: 'bottom' },
                        { top: r.top - bh - GAP, left: r.left + r.width / 2 - bw / 2, side: 'top' },
                    ];
                case 'left':
                    return [
                        { top: r.top + r.height / 2 - bh / 2, left: r.left - bw - GAP, side: 'left' },
                        { top: r.top + r.height / 2 - bh / 2, left: r.right + GAP, side: 'right' },
                    ];
                case 'right':
                    return [
                        { top: r.top + r.height / 2 - bh / 2, left: r.right + GAP, side: 'right' },
                        { top: r.top + r.height / 2 - bh / 2, left: r.left - bw - GAP, side: 'left' },
                    ];
                case 'top':
                default:
                    return [
                        { top: r.top - bh - GAP, left: r.left + r.width / 2 - bw / 2, side: 'top' },
                        { top: r.bottom + GAP, left: r.left + r.width / 2 - bw / 2, side: 'bottom' },
                    ];
            }
        })();

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const fits = (p: Position) => p.top >= 0 && p.left >= 0 && p.top + bh <= vh && p.left + bw <= vw;
        const chosen = candidates.find(fits) ?? candidates[0];
        // Final clamp so the bubble never overflows the viewport edges.
        return {
            ...chosen,
            top: Math.max(4, Math.min(chosen.top, vh - bh - 4)),
            left: Math.max(4, Math.min(chosen.left, vw - bw - 4)),
        };
    }, [side]);

    const show = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        if (trigger instanceof HTMLButtonElement && trigger.disabled) return;
        if (trigger.getAttribute('aria-disabled') === 'true') return;
        clearTimer();
        timerRef.current = setTimeout(() => {
            const root = trigger.closest('[data-bk-root]') as HTMLElement | null;
            setPortalTarget(root ?? (typeof document !== 'undefined' ? document.body : null));
            setPosition(computePosition());
            setOpen(true);
        }, delay);
    }, [computePosition, delay]);

    const hide = useCallback(() => {
        clearTimer();
        setOpen(false);
    }, []);

    // After the bubble mounts, re-measure once so position uses the real width.
    useEffect(() => {
        if (open) setPosition(computePosition());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => () => clearTimer(), []);

    if (!isValidElement<{ onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler; onFocus?: React.FocusEventHandler; onBlur?: React.FocusEventHandler; title?: string; ref?: React.Ref<HTMLElement> }>(children)) {
        return children;
    }

    const childProps = children.props;
    const mergedRef = (node: HTMLElement | null) => {
        triggerRef.current = node;
        const original = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;
        if (typeof original === 'function') original(node);
        else if (original && typeof original === 'object' && 'current' in original)
            (original as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const cloned = cloneElement(children, {
        ref: mergedRef,
        // Remove native title so the OS tooltip doesn't double up with ours.
        title: undefined,
        onMouseEnter: (e: React.MouseEvent) => {
            childProps.onMouseEnter?.(e as React.MouseEvent<HTMLElement>);
            show();
        },
        onMouseLeave: (e: React.MouseEvent) => {
            childProps.onMouseLeave?.(e as React.MouseEvent<HTMLElement>);
            hide();
        },
        onFocus: (e: React.FocusEvent) => {
            childProps.onFocus?.(e as React.FocusEvent<HTMLElement>);
            show();
        },
        onBlur: (e: React.FocusEvent) => {
            childProps.onBlur?.(e as React.FocusEvent<HTMLElement>);
            hide();
        },
    });

    return (
        <>
            {cloned}
            {open && portalTarget && position
                ? createPortal(
                      <div
                          ref={bubbleRef}
                          className="bk-tooltip"
                          role="tooltip"
                          data-state="open"
                          data-side={position.side}
                          style={{ top: position.top, left: position.left }}
                      >
                          {label}
                          {shortcut ? <span className="bk-shortcut">{shortcut}</span> : null}
                      </div>,
                      portalTarget,
                  )
                : null}
        </>
    );
}
