import { useState, useCallback, useEffect } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseFollowModeResult {
    followingUserId: string | null;
    follow: (userId: string) => void;
    unfollow: () => void;
    isFollowing: boolean;
}

export function useFollowMode(): UseFollowModeResult {
    const { store } = useBoardKit();
    const [followingUserId, setFollowingUserId] = useState<string | null>(null);

    const follow = useCallback((userId: string) => {
        setFollowingUserId(userId);
    }, []);

    const unfollow = useCallback(() => {
        setFollowingUserId(null);
    }, []);

    // Presence is event driven; never run a perpetual animation loop.
    useEffect(() => {
        if (!followingUserId) return;
        const update = () => {
            const cursor = store.getState().cursors.get(followingUserId);
            if (!cursor) {
                if (!store.getState().participants.has(followingUserId)) setFollowingUserId(null);
                return;
            }
            store.setActivePageId(cursor.pageId);
            if (cursor.viewport) store.updateViewport(() => cursor.viewport!);
        };
        update();
        const unsubscribeCursor = store.subscribe('cursors', update);
        const unsubscribeParticipants = store.subscribe('participants', update);
        return () => { unsubscribeCursor(); unsubscribeParticipants(); };
    }, [followingUserId, store]);

    return {
        followingUserId,
        follow,
        unfollow,
        isFollowing: followingUserId !== null,
    };
}
