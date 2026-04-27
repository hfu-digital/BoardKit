import { useState, useEffect, useCallback, useRef } from 'react';
import type { ElementMutation, ServerMessage, ClientMessage } from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';
import { io, Socket } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const MAX_RECONNECT_ATTEMPTS = 5;
const OUTBOUND_FLUSH_DEBOUNCE_MS = 50;

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

        // `/board` is a Socket.IO namespace (server uses `@WebSocketGateway({ namespace: '/board' })`),
        // not an HTTP path — it must be appended to the URL, leaving the default `/socket.io/` path.
        const socket = io(`${config.wsUrl.replace(/\/$/, '')}/board`, {
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

        // Outbound mutation pump. Tool handlers enqueue mutations on the store's
        // 'outbound' slice; this debounced drainer batches them onto the wire.
        // Mutations queued while disconnected stay in `bufferedOnDisconnect`
        // and ship after reconnect (`onConnect` kicks the timer). Without this
        // loop, local edits never reach the server and the board never persists.
        let pendingTimer: ReturnType<typeof setTimeout> | null = null;
        let bufferedOnDisconnect: ElementMutation[] = [];

        const flushOutbound = () => {
            pendingTimer = null;
            const drained = store.drainOutboundMutations();
            const all = bufferedOnDisconnect.length > 0
                ? [...bufferedOnDisconnect, ...drained]
                : drained;
            if (all.length === 0) return;
            if (!socket.connected) {
                bufferedOnDisconnect = all;
                return;
            }
            bufferedOnDisconnect = [];
            socket.emit('mutate', {
                mutations: all,
                requestId: `req-${++requestIdRef.current}`,
            });
        };

        const scheduleFlush = () => {
            if (pendingTimer !== null) clearTimeout(pendingTimer);
            pendingTimer = setTimeout(flushOutbound, OUTBOUND_FLUSH_DEBOUNCE_MS);
        };

        const unsubscribeOutbound = store.subscribe('outbound', scheduleFlush);

        // The connect handler does both jobs: emit `join` so the server attaches
        // us to the room, then flush any mutations buffered during a disconnect.
        // Running both from one handler keeps ordering deterministic — join always
        // emits before flush.
        const onConnect = () => {
            setConnectionState('connecting');

            const joinPayload: Omit<ClientMessage & { type: 'join' }, 'type'> = {
                boardId,
                token: config.authToken ?? '',
                lastSequence: lastSequenceRef.current || undefined,
            };
            socket.emit('join', joinPayload);

            if (bufferedOnDisconnect.length > 0 || store.getState().outboundMutations.length > 0) {
                scheduleFlush();
            }
        };
        socket.on('connect', onConnect);

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
            unsubscribeOutbound();
            if (pendingTimer !== null) clearTimeout(pendingTimer);
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
