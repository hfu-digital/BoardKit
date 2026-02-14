import React, { useRef, useEffect, useState } from 'react';
import type { Point, TextStyle } from '@boardkit/core';
import { DEFAULT_TEXT_STYLE } from '@boardkit/core';

export interface TextEditorProps {
    position: Point;
    initialContent?: string;
    style?: Partial<TextStyle>;
    zoom: number;
    onCommit: (content: string) => void;
    onCancel: () => void;
    className?: string;
}

export function TextEditor({
    position,
    initialContent = '',
    style: textStyle,
    zoom,
    onCommit,
    onCancel,
    className,
}: TextEditorProps) {
    const [content, setContent] = useState(initialContent);
    const editorRef = useRef<HTMLTextAreaElement>(null);

    const mergedStyle = { ...DEFAULT_TEXT_STYLE, ...textStyle };

    useEffect(() => {
        editorRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(content);
        }
    };

    const handleBlur = () => {
        if (content.trim()) {
            onCommit(content);
        } else {
            onCancel();
        }
    };

    return (
        <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={className}
            style={{
                position: 'absolute',
                left: position.x * zoom,
                top: position.y * zoom,
                minWidth: 200 * zoom,
                minHeight: 40 * zoom,
                fontFamily: mergedStyle.fontFamily,
                fontSize: mergedStyle.fontSize * zoom,
                fontWeight: mergedStyle.fontWeight,
                fontStyle: mergedStyle.fontStyle,
                color: mergedStyle.color,
                textAlign: mergedStyle.textAlign,
                background: 'transparent',
                border: '1px dashed #2196F3',
                outline: 'none',
                resize: 'both',
                overflow: 'hidden',
                padding: 4,
                zIndex: 1000,
            }}
        />
    );
}
