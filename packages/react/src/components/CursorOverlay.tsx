import React from 'react';
import { usePresence } from '../hooks/usePresence';
import { useViewport } from '../hooks/useViewport';
import { worldToScreen } from '../engine/viewport';

export interface CursorOverlayProps {
    className?: string;
    participantColors?: Map<string, { color: string; name: string }>;
}

export function CursorOverlay({ className, participantColors }: CursorOverlayProps) {
    const { cursors } = usePresence();
    const { viewport } = useViewport();

    return (
        <div className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {cursors.map((cursor) => {
                const screenPos = worldToScreen(cursor.position, viewport);
                const info = participantColors?.get(cursor.userId);
                const color = info?.color ?? '#666';
                const name = info?.name ?? cursor.userId;

                return (
                    <div
                        key={cursor.userId}
                        style={{
                            position: 'absolute',
                            left: screenPos.x,
                            top: screenPos.y,
                            pointerEvents: 'none',
                            transition: 'left 50ms linear, top 50ms linear',
                        }}
                    >
                        <svg width="16" height="22" viewBox="0 0 16 22" fill="none">
                            <path d="M0 0L0 16L4.5 12.5L8 20L11 18.5L7.5 11L12 10L0 0Z" fill={color} />
                        </svg>
                        <div
                            style={{
                                position: 'absolute',
                                left: 14,
                                top: 12,
                                backgroundColor: color,
                                color: '#fff',
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 3,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
