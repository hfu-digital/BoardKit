import React from 'react';
import type { Rect } from '@boardkit/core';

export interface SelectionHandlesProps {
    bounds: Rect;
    zoom: number;
    onResize?: (corner: string, delta: { x: number; y: number }) => void;
    onRotate?: (angle: number) => void;
    className?: string;
}

export function SelectionHandles({
    bounds,
    zoom,
    className,
}: SelectionHandlesProps) {
    const handleSize = 8 / zoom;

    const corners = [
        { id: 'tl', x: bounds.x, y: bounds.y },
        { id: 'tr', x: bounds.x + bounds.width, y: bounds.y },
        { id: 'bl', x: bounds.x, y: bounds.y + bounds.height },
        {
            id: 'br',
            x: bounds.x + bounds.width,
            y: bounds.y + bounds.height,
        },
    ];

    return (
        <div className={className}>
            {/* Selection box rendered by the canvas interactive layer */}
            {/* This component provides DOM overlay handles for precise interaction */}
            {corners.map((corner) => (
                <div
                    key={corner.id}
                    style={{
                        position: 'absolute',
                        left: corner.x * zoom - handleSize / 2,
                        top: corner.y * zoom - handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                        backgroundColor: '#fff',
                        border: '1.5px solid #2196F3',
                        cursor: `${corner.id}-resize`,
                        pointerEvents: 'auto',
                    }}
                />
            ))}
        </div>
    );
}
