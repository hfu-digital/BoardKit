import { Injectable } from '@nestjs/common';
import type { Participant, ElementMutation } from '@hfu.digital/boardkit-core';
import { BoardStorage, type ElementUpsert } from '../interfaces/board-storage.interface';
import { EventLogStorage } from '../interfaces/event-log-storage.interface';

export type SessionState = 'created' | 'active' | 'idle' | 'archived';

export interface BoardSession {
    boardId: string;
    participants: Map<string, Participant>;
    pendingMutations: ElementMutation[];
    currentSequence: number;
    lastFlush: number;
    state: SessionState;
    idleSince: number | null;
    sessionType: 'ephemeral' | 'persistent';
}

export interface JoinResult {
    session: BoardSession;
    syncType: 'full' | 'delta';
    missedMutations?: ElementMutation[];
}

export interface SessionStats {
    activeSessions: number;
    idleSessions: number;
    totalParticipants: number;
}

const IDLE_CHECK_INTERVAL = 60_000; // 60 seconds
const EPHEMERAL_IDLE_TIMEOUT = 300_000; // 5 minutes
const PERSISTENT_IDLE_TIMEOUT = 900_000; // 15 minutes

@Injectable()
export class CollaborationService {
    private sessions = new Map<string, BoardSession>();
    private idleChecker: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly storage: BoardStorage,
        private readonly eventLog: EventLogStorage,
    ) {}

    async joinSession(
        boardId: string,
        userId: string,
        displayName: string,
        lastSequence?: number,
        sessionType?: 'ephemeral' | 'persistent',
    ): Promise<JoinResult> {
        let session = this.sessions.get(boardId);

        if (!session) {
            const currentSequence = await this.eventLog.getLatestSequence(boardId);

            // Determine session type: use provided value, or look up from storage, default to 'persistent'
            let resolvedSessionType: 'ephemeral' | 'persistent' = sessionType ?? 'persistent';
            if (!sessionType) {
                const board = await this.storage.getBoard(boardId);
                if (board) {
                    resolvedSessionType = board.sessionType;
                }
            }

            session = {
                boardId,
                participants: new Map(),
                pendingMutations: [],
                currentSequence,
                lastFlush: Date.now(),
                state: 'created',
                idleSince: null,
                sessionType: resolvedSessionType,
            };
            this.sessions.set(boardId, session);
            this.startIdleChecker();
        }

        // Transition from idle back to active when a participant joins
        if (session.state === 'idle') {
            session.state = 'active';
            session.idleSince = null;
        }

        // Add participant
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        const colorIndex = session.participants.size % colors.length;
        session.participants.set(userId, {
            userId,
            displayName,
            color: colors[colorIndex],
            joinedAt: new Date().toISOString(),
        });

        // Transition from created to active when first participant joins
        if (session.state === 'created') {
            session.state = 'active';
        }

        // Determine sync type
        if (lastSequence !== undefined && lastSequence < session.currentSequence) {
            const events = await this.eventLog.getEvents(boardId, lastSequence);
            if (events.length > 0 && events.length < 1000) {
                const missedMutations: ElementMutation[] = events.map((e) => ({
                    type: (e.payload as any).mutationType ?? 'update',
                    elementId: (e.payload as any).elementId ?? '',
                    pageId: e.pageId ?? '',
                    data: (e.payload as any).data,
                    timestamp: new Date(e.timestamp).getTime(),
                }));
                return { session, syncType: 'delta', missedMutations };
            }
        }

        return { session, syncType: 'full' };
    }

    async leaveSession(boardId: string, userId: string): Promise<void> {
        const session = this.sessions.get(boardId);
        if (!session) return;

        session.participants.delete(userId);

        if (session.participants.size === 0) {
            session.state = 'idle';
            session.idleSince = Date.now();
        }
    }

    async applyMutations(
        boardId: string,
        userId: string,
        mutations: ElementMutation[],
    ): Promise<number> {
        const session = this.sessions.get(boardId);
        if (!session) throw new Error(`No active session for board ${boardId}`);

        session.pendingMutations.push(...mutations);
        session.currentSequence++;

        // Log events
        for (const mutation of mutations) {
            await this.eventLog.append({
                boardId,
                pageId: mutation.pageId,
                type: mutation.type === 'create'
                    ? 'elementCreated'
                    : mutation.type === 'update'
                        ? 'elementUpdated'
                        : 'elementDeleted',
                payload: {
                    mutationType: mutation.type,
                    elementId: mutation.elementId,
                    data: mutation.data,
                },
                userId,
                sequence: session.currentSequence,
                timestamp: new Date().toISOString(),
            });
        }

        return session.currentSequence;
    }

    async getSessionState(boardId: string): Promise<BoardSession | null> {
        return this.sessions.get(boardId) ?? null;
    }

    getSessionStats(): SessionStats {
        let activeSessions = 0;
        let idleSessions = 0;
        let totalParticipants = 0;

        for (const session of this.sessions.values()) {
            if (session.state === 'active') {
                activeSessions++;
            } else if (session.state === 'idle') {
                idleSessions++;
            }
            totalParticipants += session.participants.size;
        }

        return { activeSessions, idleSessions, totalParticipants };
    }

    async flushPending(boardId: string): Promise<void> {
        const session = this.sessions.get(boardId);
        if (!session || session.pendingMutations.length === 0) return;

        const mutations = [...session.pendingMutations];
        session.pendingMutations = [];
        session.lastFlush = Date.now();

        // Convert mutations to upserts
        const upserts: ElementUpsert[] = [];
        const deletes: string[] = [];

        for (const m of mutations) {
            if (m.type === 'delete') {
                deletes.push(m.elementId);
            } else if (m.data) {
                upserts.push({
                    id: m.elementId,
                    pageId: m.pageId,
                    type: (m.data as any).type ?? 'stroke',
                    data: (m.data as any).data ?? {},
                    zIndex: (m.data as any).zIndex ?? 0,
                    createdBy: (m.data as any).createdBy ?? '',
                });
            }
        }

        if (upserts.length > 0) {
            const pageGroups = new Map<string, ElementUpsert[]>();
            for (const u of upserts) {
                const group = pageGroups.get(u.pageId) ?? [];
                group.push(u);
                pageGroups.set(u.pageId, group);
            }
            for (const [pageId, group] of pageGroups) {
                await this.storage.upsertElements(pageId, group);
            }
        }

        if (deletes.length > 0) {
            await this.storage.deleteElements(deletes);
        }
    }

    async checkIdleSessions(): Promise<void> {
        const now = Date.now();
        const toArchive: string[] = [];

        for (const [boardId, session] of this.sessions) {
            if (session.state !== 'idle' || session.idleSince === null) {
                continue;
            }

            const idleDuration = now - session.idleSince;

            if (
                session.sessionType === 'ephemeral' &&
                idleDuration > EPHEMERAL_IDLE_TIMEOUT
            ) {
                toArchive.push(boardId);
            } else if (
                session.sessionType === 'persistent' &&
                idleDuration > PERSISTENT_IDLE_TIMEOUT
            ) {
                toArchive.push(boardId);
            }
        }

        for (const boardId of toArchive) {
            await this.archiveSession(boardId);
        }
    }

    startIdleChecker(): void {
        if (this.idleChecker !== null) {
            return;
        }
        this.idleChecker = setInterval(() => {
            this.checkIdleSessions();
        }, IDLE_CHECK_INTERVAL);
    }

    stopIdleChecker(): void {
        if (this.idleChecker !== null) {
            clearInterval(this.idleChecker);
            this.idleChecker = null;
        }
    }

    async closeSession(boardId: string): Promise<void> {
        await this.flushPending(boardId);
        this.sessions.delete(boardId);

        if (this.sessions.size === 0) {
            this.stopIdleChecker();
        }
    }

    private async archiveSession(boardId: string): Promise<void> {
        const session = this.sessions.get(boardId);
        if (!session) return;

        // Flush any pending mutations before archiving
        await this.flushPending(boardId);

        // Create snapshot for persistent sessions
        if (session.sessionType === 'persistent') {
            const pages = await this.storage.getPages(boardId);
            const snapshotData: Record<string, unknown> = {};

            for (const page of pages) {
                const elements = await this.storage.getElements(page.id);
                snapshotData[page.id] = elements;
            }

            await this.eventLog.createSnapshot(
                boardId,
                snapshotData,
                session.currentSequence,
            );
        }

        // Mark as archived and remove from sessions map
        session.state = 'archived';
        this.sessions.delete(boardId);

        // Stop idle checker if no sessions remain
        if (this.sessions.size === 0) {
            this.stopIdleChecker();
        }
    }
}
