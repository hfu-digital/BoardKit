import { useState, useEffect } from 'react';
import type { ElementMutation, ServerMessage, Element, Page, Board } from '@hfu.digital/boardkit-core';
import { useBoardKit, type BoardKitConfig } from '../context/BoardKitProvider';
import type { BoardStore } from '../store/board-store';
import { applyMutations, hydrateScene } from '../store/scene-sync';
import { io } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type SaveState = 'loading' | 'saved' | 'saving' | 'offline' | 'error';
export interface UseCollaborationResult {
    connectionState: ConnectionState;
    saveState: SaveState;
    pendingCount: number;
    isHydrated: boolean;
    retryPending: () => void;
    sendMutations: (mutations: ElementMutation[]) => void;
    sendCursor: (position: { x: number; y: number }, pageId: string) => void;
    disconnect: () => void;
}

/** One runtime per provider: subscriptions never own/drain separate queues. */
export class CollaborationRuntime {
    refs = 0;
    connectionState: ConnectionState = 'disconnected';
    private ready = false;
    private duringSync: ElementMutation[] = [];
    private syncPages: Page[] | null = null;
    private failed = false;
    private rejected = false;
    private oversized: ElementMutation[] = [];
    private batch: { requestId: string; mutations: ElementMutation[] } | null = null;
    private socket: ReturnType<typeof io> | null = null;
    private heartbeat?: ReturnType<typeof setInterval>;
    private timer?: ReturnType<typeof setTimeout>;
    private ackTimer?: ReturnType<typeof setTimeout>;
    private listeners = new Set<() => void>();
    private unsubscribe?: () => void;
    private unsubscribePresence?: () => void;
    constructor(readonly store: BoardStore, readonly boardId: string) {}
    subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
    private changed = () => { for (const fn of this.listeners) fn(); };
    snapshot(): UseCollaborationResult {
        const pendingCount = this.oversized.length + (this.batch?.mutations.length ?? 0) + this.store.getState().outboundMutations.length;
        const isHydrated = this.store.getState().isHydrated;
        return { connectionState: this.connectionState, isHydrated, pendingCount,
            saveState: this.failed || this.oversized.length ? 'error' : this.connectionState !== 'connected' ? 'offline' : !isHydrated ? 'loading' : pendingCount ? 'saving' : 'saved',
            retryPending: this.retryPending, sendMutations: this.sendMutations, sendCursor: this.sendCursor, disconnect: this.stop };
    }
    private pending = () => [...this.oversized, ...(this.batch?.mutations ?? []), ...this.store.getState().outboundMutations];
    private schedule = () => { clearTimeout(this.timer); this.changed(); this.timer = setTimeout(this.flush, 50); };
    private flush = () => {
        if (!this.ready || !this.socket?.connected || this.failed || this.ackTimer) return;
        if (!this.batch) {
            const queue = this.store.getState().outboundMutations;
            const encoder = new TextEncoder();
            const mutations: ElementMutation[] = [];
            let bytes = 2;
            while (queue.length && mutations.length < 200) {
                const nextBytes = encoder.encode(JSON.stringify(queue[0])).byteLength;
                if (nextBytes + 2 > 1024 * 1024) {
                    this.oversized.push(queue.shift()!);
                    this.store.setError({ code: 'MUTATION_TOO_LARGE', message: 'An edit exceeds the 1 MiB save limit. Copy your unsaved edit before leaving; reduce it before retrying.', timestamp: Date.now(), recoverable: true });
                    continue;
                }
                const addition = nextBytes + (mutations.length ? 1 : 0);
                if (bytes + addition > 1024 * 1024) break;
                bytes += addition;
                mutations.push(queue.shift()!);
            }
            if (!mutations.length) { this.changed(); return; }
            this.batch = { requestId: globalThis.crypto.randomUUID(), mutations };
        }
        this.socket.emit('mutate', this.batch);
        this.ackTimer = setTimeout(() => { this.ackTimer = undefined; this.failed = true; this.changed(); }, 10000);
        this.changed();
    };
    retryPending = () => {
        // Preserve unsaved payloads; retry can use a reduced element from the scene.
        const retained = this.oversized.splice(0).map(m => {
            const current = this.store.getState().scene.elements.get(m.elementId);
            return current && m.type !== 'delete' ? { ...m, data: current } : m;
        });
        this.store.getState().outboundMutations.unshift(...retained);
        // Only rewrite a definitively rejected request. An uncertain ACK timeout
        // must retain its original identity so a committed batch is not repeated.
        if (this.rejected && this.batch) {
            const pages = new Set(this.store.getState().pages.map(p => p.id));
            const mutations = this.batch.mutations.filter(m => pages.has(m.pageId));
            this.batch = mutations.length ? { requestId: globalThis.crypto.randomUUID(), mutations } : null;
        }
        this.rejected = false; this.failed = false; clearTimeout(this.ackTimer); this.ackTimer = undefined; this.socket?.connect(); this.flush(); this.changed(); };
    sendMutations = (mutations: ElementMutation[]) => this.store.enqueueOutboundMutations(mutations);
    sendCursor = (position: { x: number; y: number }, pageId: string) => {
        if (this.ready) this.socket?.emit('cursor', { position, pageId, viewport: this.store.getState().viewport });
    };
    start(config: BoardKitConfig) {
        if (this.socket || !config.wsUrl) return;
        this.connectionState = 'connecting'; this.changed();
        const socket = this.socket = io(`${config.wsUrl.replace(/\/$/, '')}/board`, { transports: ['websocket'], auth: { token: config.authToken ?? '' } });
        this.heartbeat = setInterval(() => { if (this.ready) socket.emit('ping', { timestamp: Date.now() }); }, 20000);
        this.unsubscribe = this.store.subscribe('outbound', this.schedule);
        let presenceTimer: ReturnType<typeof setTimeout>;
        const sendPresence = () => {
            clearTimeout(presenceTimer);
            presenceTimer = setTimeout(() => {
                const { activePageId, viewport } = this.store.getState();
                if (activePageId) this.sendCursor({ x: -viewport.offset.x / viewport.zoom, y: -viewport.offset.y / viewport.zoom }, activePageId);
            }, 80);
        };
        const unsubViewport = this.store.subscribe('viewport', sendPresence);
        const unsubPages = this.store.subscribe('pages', sendPresence);
        this.unsubscribePresence = () => { unsubViewport(); unsubPages(); clearTimeout(presenceTimer); };
        socket.on('connect', () => { this.ready = false; this.duringSync = []; this.syncPages = null; this.connectionState = 'connecting'; socket.emit('join', { boardId: this.boardId, token: config.authToken ?? '' }); this.changed(); });
        socket.on('message', (message: ServerMessage) => {
            switch (message.type) {
                case 'pages:updated': {
                    if (!this.ready) this.syncPages = message.pages;
                    this.store.setPages(message.pages);
                    const ids = new Set(message.pages.map(p => p.id));
                    const queue = this.store.getState().outboundMutations;
                    const kept = queue.filter(m => ids.has(m.pageId));
                    if (kept.length !== queue.length) {
                        queue.splice(0, queue.length, ...kept);
                        this.failed = true;
                        this.store.setError({ code: 'PAGE_DELETED', message: 'Pending changes targeted a deleted page', timestamp: Date.now(), recoverable: true });
                    }
                    break;
                }
                case 'joined':
                    this.store.setParticipants(new Map(message.participants.map(p => [p.userId, { ...p, joinedAt: new Date().toISOString() }])));
                    break;
                case 'sync:full':
                    hydrateScene(this.store, message.boardData as { board?: Board; pages?: Page[]; elements?: Record<string, Element[]> }, this.batch?.mutations);
                    if (this.syncPages) { this.store.setPages(this.syncPages); this.syncPages = null; }
                    applyMutations(this.store, this.duringSync); applyMutations(this.store, this.pending()); this.duringSync = [];
                    this.ready = true; this.connectionState = 'connected'; this.schedule(); break;
                case 'sync:delta':
                    applyMutations(this.store, message.mutations); applyMutations(this.store, this.pending());
                    this.store.setHydrated(true); this.ready = true; this.connectionState = 'connected'; this.schedule(); break;
                case 'mutation:ack':
                    if (message.requestId === this.batch?.requestId) {
                        clearTimeout(this.ackTimer); this.ackTimer = undefined; this.batch = null; this.failed = false; this.schedule();
                    } break;
                case 'mutation:broadcast':
                    if (!this.ready) this.duringSync.push(...message.mutations);
                    applyMutations(this.store, message.mutations); applyMutations(this.store, this.pending()); break;
                case 'cursor:broadcast': this.store.updateCursor(message.userId, message); break;
                case 'participant:joined': {
                    const participants = new Map(this.store.getState().participants);
                    participants.set(message.userId, { ...message, joinedAt: new Date().toISOString() }); this.store.setParticipants(participants); break;
                }
                case 'participant:left': {
                    this.store.removeCursor(message.userId);
                    const participants = new Map(this.store.getState().participants); participants.delete(message.userId); this.store.setParticipants(participants); break;
                }
                case 'error': this.rejected = message.code === 'INVALID_MUTATION'; this.failed = true; this.store.setError({ code: message.code, message: message.message, timestamp: Date.now(), recoverable: true }); break;
                case 'rate-limited':
                    clearTimeout(this.ackTimer); this.ackTimer = undefined;
                    clearTimeout(this.timer); this.timer = setTimeout(this.flush, message.retryAfterMs); break;
            }
            this.changed();
        });
        socket.on('disconnect', () => {
            this.ready = false; this.connectionState = 'reconnecting';
            clearTimeout(this.ackTimer); this.ackTimer = undefined;
            this.store.setParticipants(new Map());
            for (const id of this.store.getState().cursors.keys()) this.store.removeCursor(id);
            this.changed();
        });
        socket.on('connect_error', () => { this.connectionState = 'disconnected'; this.changed(); });
    }
    stop = () => {
        this.ready = false; clearInterval(this.heartbeat); this.unsubscribe?.(); this.unsubscribePresence?.(); clearTimeout(this.timer); clearTimeout(this.ackTimer); this.ackTimer = undefined;
        this.socket?.removeAllListeners(); this.socket?.disconnect(); this.socket = null; this.connectionState = 'disconnected'; this.changed();
    };
}
const runtimes = new WeakMap<BoardStore, CollaborationRuntime>();
export function useCollaboration(boardId: string): UseCollaborationResult {
    const { config, store } = useBoardKit();
    let runtime = runtimes.get(store);
    if (!runtime || runtime.boardId !== boardId) {
        runtime?.stop(); runtime = new CollaborationRuntime(store, boardId); runtimes.set(store, runtime);
    }
    const current = runtime;
    const [, render] = useState(0);
    useEffect(() => {
        const unsubscribe = current.subscribe(() => render(n => n + 1));
        current.refs++; current.start(config); render(n => n + 1);
        return () => { unsubscribe(); if (--current.refs === 0) current.stop(); };
    }, [current, config.wsUrl, config.authToken]);
    return current.snapshot();
}
