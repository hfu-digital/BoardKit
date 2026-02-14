import { useState, useEffect, useCallback, useRef } from 'react';
import type { ElementMutation, ServerMessage, ClientMessage } from '@boardkit/core';
import { PROTOCOL_VERSION } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';

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
    const wsRef = useRef<WebSocket | null>(null);
    const requestIdRef = useRef(0);
    const reconnectAttemptRef = useRef(0);
    const lastSequenceRef = useRef(0);
    const sessionIdRef = useRef<string | null>(null);

    const connect = useCallback(() => {
        if (!config.wsUrl) return;

        // Check if max retries exceeded
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionState('disconnected');
            store.setError({
                code: 'MAX_RETRIES_EXCEEDED',
                message: `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
                timestamp: Date.now(),
                recoverable: true,
            });
            return;
        }

        setConnectionState('connecting');

        const ws = new WebSocket(config.wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            reconnectAttemptRef.current = 0;
            const joinMsg: ClientMessage = {
                type: 'join',
                boardId,
                token: config.authToken ?? '',
                lastSequence: lastSequenceRef.current || undefined,
            };
            ws.send(JSON.stringify(joinMsg));
        };

        ws.onmessage = (event) => {
            const message: ServerMessage = JSON.parse(event.data);

            switch (message.type) {
                case 'joined':
                    setConnectionState('connected');
                    lastSequenceRef.current = message.currentSequence;
                    // Set session ID on join
                    sessionIdRef.current = `${message.userId}-${message.currentSequence}`;
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

                    // Handle session mismatch
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
        };

        ws.onclose = () => {
            wsRef.current = null;
            if (connectionState !== 'disconnected') {
                setConnectionState('reconnecting');
                reconnectAttemptRef.current++;

                if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    setConnectionState('disconnected');
                    store.setError({
                        code: 'MAX_RETRIES_EXCEEDED',
                        message: `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
                        timestamp: Date.now(),
                        recoverable: true,
                    });
                    return;
                }

                // Exponential backoff with jitter
                const delay = Math.min(
                    1000 * Math.pow(2, reconnectAttemptRef.current) + Math.random() * 1000,
                    30000,
                );
                setTimeout(connect, delay);
            }
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [boardId, config.wsUrl, config.authToken, store]);

    useEffect(() => {
        connect();
        return () => {
            setConnectionState('disconnected');
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    const sendMutations = useCallback((mutations: ElementMutation[]) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const msg: ClientMessage = {
            type: 'mutate',
            mutations,
            requestId: `req-${++requestIdRef.current}`,
        };
        ws.send(JSON.stringify(msg));
    }, []);

    const sendCursor = useCallback((position: { x: number; y: number }, pageId: string) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const msg: ClientMessage = {
            type: 'cursor',
            position,
            pageId,
        };
        ws.send(JSON.stringify(msg));
    }, []);

    const disconnect = useCallback(() => {
        setConnectionState('disconnected');
        wsRef.current?.close();
        wsRef.current = null;
    }, []);

    return { connectionState, sendMutations, sendCursor, disconnect };
}
