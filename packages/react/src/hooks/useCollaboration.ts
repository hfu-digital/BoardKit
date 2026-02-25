import { useState, useEffect, useCallback, useRef } from 'react';
import type { ElementMutation, ServerMessage, ClientMessage } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';
import { io, Socket } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const MAX_RECONNECT_ATTEMPTS = 5;

export interface UseCollaborationResult {
    connectionState: ConnectionState;
    sendMutations: (mutations: ElementMutation[]) => void;
    sendCursor: (position: { x: number; y: number }, pageId: string) => void;
    disconnect: () => void;
}

export function useCollaboration(boardId: string): UseCollaborationResult {
    const { config, store } = useBoardKit();
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const socketRef = useRef<Socket | null>(null);
    const requestIdRef = useRef(0);
    const lastSequenceRef = useRef(0);

    useEffect(() => {
        if (!config.wsUrl) return;

        const socket = io(config.wsUrl, {
            path: '/board',
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            auth: {
                token: config.authToken ?? '',
            },
        });

        socketRef.current = socket;
        setConnectionState('connecting');

        socket.on('connect', () => {
            setConnectionState('connecting');

            const joinPayload: Omit<ClientMessage & { type: 'join' }, 'type'> = {
                boardId,
                token: config.authToken ?? '',
                lastSequence: lastSequenceRef.current || undefined,
            };
            socket.emit('join', joinPayload);
        });

        socket.on('message', (message: ServerMessage) => {
            switch (message.type) {
                case 'joined':
                    setConnectionState('connected');
                    lastSequenceRef.current = message.currentSequence;
                    break;

                case 'sync:delta':
                    lastSequenceRef.current = message.toSequence;
                    break;

                case 'sync:full':
                    lastSequenceRef.current = message.currentSequence;
                    break;

                case 'mutation:ack':
                    lastSequenceRef.current = message.sequence;
                    break;

                case 'mutation:broadcast': {
                    lastSequenceRef.current = message.sequence;

                    // Filter out mutations targeting non-existent pages
                    const { pages } = store.getState();
                    const pageIds = new Set(pages.map((p) => p.id));
                    const validMutations = message.mutations.filter((m) => {
                        if (pageIds.size > 0 && !pageIds.has(m.pageId)) {
                            console.warn(
                                `Skipping mutation for non-existent page: ${m.pageId}`,
                            );
                            return false;
                        }
                        return true;
                    });

                    if (validMutations.length === 0) break;

                    // Apply remote mutations to store
                    store.updateScene((scene) => {
                        let s = scene;
                        for (const m of validMutations) {
                            if (m.type === 'create' && m.data) {
                                const elements = new Map(s.elements);
                                elements.set(m.elementId, m.data as any);
                                s = { elements, elementOrder: [...s.elementOrder, m.elementId] };
                            } else if (m.type === 'delete') {
                                const elements = new Map(s.elements);
                                elements.delete(m.elementId);
                                s = { elements, elementOrder: s.elementOrder.filter((id) => id !== m.elementId) };
                            }
                        }
                        return s;
                    });
                    break;
                }

                case 'cursor:broadcast':
                    store.updateCursor(message.userId, {
                        userId: message.userId,
                        position: message.position,
                        pageId: message.pageId,
                    });
                    break;

                case 'participant:joined':
                    break;

                case 'participant:left':
                    store.removeCursor(message.userId);
                    break;

                case 'rate-limited':
                    console.warn(`Rate limited. Retry after ${message.retryAfterMs}ms`);
                    break;

                case 'error':
                    console.error(`Server error: ${message.code} - ${message.message}`);
                    if (message.code === 'SESSION_MISMATCH') {
                        store.setError({
                            code: 'SESSION_MISMATCH',
                            message: message.message,
                            timestamp: Date.now(),
                            recoverable: false,
                        });
                    }
                    break;
            }
        });

        socket.on('disconnect', () => {
            setConnectionState('reconnecting');
        });

        socket.on('reconnect_failed', () => {
            setConnectionState('disconnected');
            store.setError({
                code: 'MAX_RETRIES_EXCEEDED',
                message: `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
                timestamp: Date.now(),
                recoverable: true,
            });
        });

        socket.on('reconnect_attempt', () => {
            setConnectionState('reconnecting');
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setConnectionState('disconnected');
        };
    }, [boardId, config.wsUrl, config.authToken, store]);

    const sendMutations = useCallback((mutations: ElementMutation[]) => {
        const socket = socketRef.current;
        if (!socket?.connected) return;
        socket.emit('mutate', {
            mutations,
            requestId: `req-${++requestIdRef.current}`,
        });
    }, []);

    const sendCursor = useCallback((position: { x: number; y: number }, pageId: string) => {
        const socket = socketRef.current;
        if (!socket?.connected) return;
        socket.emit('cursor', {
            position,
            pageId,
        });
    }, []);

    const disconnect = useCallback(() => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setConnectionState('disconnected');
    }, []);

    return { connectionState, sendMutations, sendCursor, disconnect };
}
