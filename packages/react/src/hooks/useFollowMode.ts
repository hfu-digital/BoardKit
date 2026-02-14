import { useState, useCallback, useEffect, useRef } from 'react';
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
    const rafRef = useRef<number | null>(null);

    const follow = useCallback((userId: string) => {
        setFollowingUserId(userId);
    }, []);

    const unfollow = useCallback(() => {
        setFollowingUserId(null);
    }, []);

    // When following, continuously update viewport to center on the followed user's cursor
    useEffect(() => {
        if (!followingUserId) return;

        const tick = () => {
            const cursor = store.getState().cursors.get(followingUserId);
            if (cursor) {
                const { viewport } = store.getState();
                // Smoothly pan to center the cursor in viewport
                const targetOffsetX = window.innerWidth / 2 - cursor.position.x * viewport.zoom;
                const targetOffsetY = window.innerHeight / 2 - cursor.position.y * viewport.zoom;

                // Lerp for smooth following
                const lerp = 0.1;
                const newOffsetX = viewport.offset.x + (targetOffsetX - viewport.offset.x) * lerp;
                const newOffsetY = viewport.offset.y + (targetOffsetY - viewport.offset.y) * lerp;

                // Only update if there's meaningful movement
                if (
                    Math.abs(newOffsetX - viewport.offset.x) > 0.5 ||
                    Math.abs(newOffsetY - viewport.offset.y) > 0.5
                ) {
                    store.updateViewport(() => ({
                        zoom: viewport.zoom,
                        offset: { x: newOffsetX, y: newOffsetY },
                    }));
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        // Unfollow if the followed user disconnects
        const unsubscribe = store.subscribe('cursors', () => {
            if (!store.getState().cursors.has(followingUserId)) {
                setFollowingUserId(null);
            }
        });

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            unsubscribe();
        };
    }, [followingUserId, store]);

    return {
        followingUserId,
        follow,
        unfollow,
        isFollowing: followingUserId !== null,
    };
}
