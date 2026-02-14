import { useState, useEffect, useCallback, useRef } from 'react';
import type { Participant, CursorPosition } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UsePresenceResult {
    participants: Participant[];
    cursors: CursorPosition[];
}

export function usePresence(): UsePresenceResult {
    const { store } = useBoardKit();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [cursors, setCursors] = useState<CursorPosition[]>([]);

    useEffect(() => {
        const unsubParticipants = store.subscribe('participants', () => {
            setParticipants(
                Array.from(store.getState().participants.values()),
            );
        });
        const unsubCursors = store.subscribe('cursors', () => {
            setCursors(
                Array.from(store.getState().cursors.values()),
            );
        });
        return () => {
            unsubParticipants();
            unsubCursors();
        };
    }, [store]);

    return { participants, cursors };
}
