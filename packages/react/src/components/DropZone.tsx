import React from 'react';

export interface DropZoneProps {
    isDragging: boolean;
    className?: string;
}

export function DropZone({ isDragging, className }: DropZoneProps) {
    if (!isDragging) return null;

    return (
        <div
            className={className}
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                border: '2px dashed #2196F3',
                borderRadius: 8,
                pointerEvents: 'none',
                zIndex: 1000,
            }}
        >
            <span style={{ fontSize: 18, color: '#2196F3' }}>
                Drop image here
            </span>
        </div>
    );
}
