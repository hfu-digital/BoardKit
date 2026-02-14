import React from 'react';
import { usePresence } from '../hooks/usePresence';

export interface ParticipantListProps {
    className?: string;
}

export function ParticipantList({ className }: ParticipantListProps) {
    const { participants } = usePresence();

    return (
        <div className={className} role="list" aria-label="Online participants">
            {participants.map((p) => (
                <div key={p.userId} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: p.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 'bold',
                        }}
                    >
                        {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span>{p.displayName}</span>
                </div>
            ))}
        </div>
    );
}
