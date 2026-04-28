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
    className,
}: TextEditorProps) {
    const [content, setContent] = useState(initialContent);
    const editorRef = useRef<HTMLTextAreaElement>(null);

    const mergedStyle = { ...DEFAULT_TEXT_STYLE, ...textStyle };
    const screen = worldToScreen(position, viewport);
    const minWidth = (initialSize?.width ?? MIN_WORLD_WIDTH) * viewport.zoom;
    const minHeight = (initialSize?.height ?? MIN_WORLD_HEIGHT) * viewport.zoom;

    // Auto-focus on mount; place caret at the end so editing existing text
    // doesn't dump the user at the start of the buffer.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    // Auto-grow height to fit content. Run after every render so wrapping
    // (driven by zoom or width changes) re-measures.
    useLayoutEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    }, [content, minHeight]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        // Always commit on blur — let the hook decide what empty content means
        // (no-op for create, delete for edit). Cancel is reserved for Escape.
        onCommit(content);
    };

    return (
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
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                zIndex: 1000,
                pointerEvents: 'auto',
            }}
        />
    );
}
