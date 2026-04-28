import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import type { Point, TextStyle } from '@hfu.digital/boardkit-core';
import { DEFAULT_TEXT_STYLE } from '@hfu.digital/boardkit-core';
import type { ViewportState } from '../engine/viewport';
import { worldToScreen } from '../engine/viewport';

export interface TextEditorProps {
    /** World-space position of the text element's top-left. */
    position: Point;
    initialContent?: string;
    style?: Partial<TextStyle>;
    /** Live viewport — drives both placement (worldToScreen) and zoom-scaled font size. */
    viewport: ViewportState;
    /**
     * Existing element size (world units). Used as the textarea's min size when
     * editing so the editor matches the element's footprint. Omitted on create.
     */
    initialSize?: { width: number; height: number };
    /** Called on Enter (no shift) and on blur. The hook differentiates empty vs non-empty. */
    onCommit: (content: string) => void;
    /** Called on Escape only — discard intent, no element changes. */
    onCancel: () => void;
    /**
     * When set, renders an inline color palette above the textarea. Clicking
     * a swatch calls `onColorChange(color)` and updates the displayed color
     * live so the user sees the change while typing — no commit/re-select
     * round-trip needed.
     */
    onColorChange?: (color: string) => void;
    /** Color swatches to render in the palette. Ignored if `onColorChange` is unset. */
    availableColors?: readonly string[];
    className?: string;
}

const MIN_WORLD_WIDTH = 200;
const MIN_WORLD_HEIGHT = 40;

/**
 * Excalidraw-style inline text editor: borderless transparent textarea
 * overlaid on the canvas at the element's world position. Font + scale
 * match the rendered canvas text exactly so what the user types is what
 * gets rendered.
 */
export function TextEditor({
    position,
    initialContent = '',
    style: textStyle,
    viewport,
    initialSize,
    onCommit,
    onCancel,
    onColorChange,
    availableColors,
    className,
}: TextEditorProps) {
    const [content, setContent] = useState(initialContent);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    // Blur fires synchronously during the initial focus race when the parent
    // pointerdown is still bubbling. We don't want that to be treated as the
    // user dismissing the editor, so blur is gated behind this flag — flipped
    // to true after one rAF tick (when the focus has truly settled).
    const settledRef = useRef(false);

    const mergedStyle = { ...DEFAULT_TEXT_STYLE, ...textStyle };
    const screen = worldToScreen(position, viewport);
    const minWidth = (initialSize?.width ?? MIN_WORLD_WIDTH) * viewport.zoom;
    const minHeight = (initialSize?.height ?? MIN_WORLD_HEIGHT) * viewport.zoom;

    // Auto-focus on mount; place caret at the end so editing existing text
    // doesn't dump the user at the start of the buffer. Defend against a
    // parent pointerdown handler that fires on the same tick and steals
    // focus back to the canvas — one rAF tick is enough for synchronous
    // handlers to settle.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        const raf = requestAnimationFrame(() => {
            if (document.activeElement !== el) {
                el.focus();
            }
            settledRef.current = true;
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // Auto-grow height + width to fit content. With `whiteSpace: 'pre'`
    // single lines extend horizontally without wrapping, so we need to
    // grow width too — otherwise long content gets clipped at minWidth and
    // the user can't see what they typed.
    useLayoutEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
        el.style.width = 'auto';
        el.style.width = `${Math.max(el.scrollWidth, minWidth)}px`;
    }, [content, minHeight, minWidth]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Stop bubbling to the global window keydown listener in
        // useKeyboardShortcuts. The hook already filters textarea targets,
        // but belt-and-suspenders against any browser quirk where the
        // target check is bypassed.
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(content);
        }
    };

    const handleBlur = () => {
        // Ignore blur during the initial-mount focus race — without this gate,
        // a parent pointerdown handler that briefly steals focus would trigger
        // an empty commit, which the hook treats as "user dismissed empty" and
        // reverts the active tool back to Select. Once settled, blur means
        // the user genuinely clicked away → commit (hook differentiates empty
        // create vs empty edit).
        if (!settledRef.current) return;
        onCommit(content);
    };

    const showPalette = Boolean(onColorChange && availableColors && availableColors.length > 0);

    return (
        <>
            <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={className}
                spellCheck={false}
                style={{
                    position: 'absolute',
                    left: screen.x,
                    top: screen.y,
                    minWidth,
                    minHeight,
                    fontFamily: mergedStyle.fontFamily,
                    fontSize: mergedStyle.fontSize * viewport.zoom,
                    fontWeight: mergedStyle.fontWeight,
                    fontStyle: mergedStyle.fontStyle,
                    color: mergedStyle.color,
                    opacity: mergedStyle.opacity,
                    textAlign: mergedStyle.textAlign,
                    lineHeight: 1.3,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    resize: 'none',
                    // `pre` (not `pre-wrap`) so the editor never inserts visual
                    // line breaks the renderer can't reproduce — the canvas
                    // text renderer splits on `\n` only and has no soft-wrap, so
                    // wrapping in the textarea would silently disappear on
                    // commit. Excalidraw model: lines extend horizontally; user
                    // presses Shift+Enter for explicit newlines. overflow:visible
                    // lets the textarea grow beyond its min-width.
                    overflow: 'visible',
                    whiteSpace: 'pre',
                    zIndex: 1000,
                    pointerEvents: 'auto',
                }}
            />
            {showPalette && (
                <div
                    className="bk-pill bk-swatch-row"
                    role="toolbar"
                    aria-label="Text color"
                    style={{
                        position: 'absolute',
                        // Anchor above the textarea. 36px clears the typical
                        // line height plus a small gap; the palette stays
                        // inside the canvas viewport because consumers wrap
                        // BoardCanvas in an overflow-hidden container.
                        left: screen.x,
                        top: screen.y - 36,
                        zIndex: 1001,
                        padding: 4,
                        gap: 4,
                    }}
                    onMouseDown={(e) => {
                        // Prevent the textarea from blurring + committing when
                        // the user clicks a swatch — without this the editor
                        // would close before the color change applied.
                        e.preventDefault();
                    }}
                >
                    {availableColors!.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className="bk-swatch"
                            style={{ background: c }}
                            data-selected={c === mergedStyle.color}
                            aria-label={`Color ${c}`}
                            onClick={() => onColorChange!(c)}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
