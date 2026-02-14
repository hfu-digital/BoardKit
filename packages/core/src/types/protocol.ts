import type { ElementMutation } from './events';
import type { Point } from './elements';

export const PROTOCOL_VERSION = 1;

// ── Client → Server Messages ──

export interface JoinMessage {
    type: 'join';
    boardId: string;
    token: string;
    lastSequence?: number;
}

export interface LeaveMessage {
    type: 'leave';
}

export interface MutateMessage {
    type: 'mutate';
    mutations: ElementMutation[];
    requestId: string;
}

export interface CursorMessage {
    type: 'cursor';
    position: Point;
    pageId: string;
}

export interface PageSwitchMessage {
    type: 'pageSwitch';
    pageId: string;
}

export interface PingMessage {
    type: 'ping';
    timestamp: number;
}

export type ClientMessage =
    | JoinMessage
    | LeaveMessage
    | MutateMessage
    | CursorMessage
    | PageSwitchMessage
    | PingMessage;

// ── Server → Client Messages ──

export interface JoinedMessage {
    type: 'joined';
    userId: string;
    boardId: string;
    participants: Array<{
        userId: string;
        displayName: string;
        color: string;
    }>;
    currentSequence: number;
}

export interface SyncDeltaMessage {
    type: 'sync:delta';
    mutations: ElementMutation[];
    fromSequence: number;
    toSequence: number;
}

export interface SyncFullMessage {
    type: 'sync:full';
    boardData: Record<string, unknown>;
    currentSequence: number;
}

export interface MutationAckMessage {
    type: 'mutation:ack';
    requestId: string;
    sequence: number;
}

export interface MutationBroadcastMessage {
    type: 'mutation:broadcast';
    userId: string;
    mutations: ElementMutation[];
    sequence: number;
}

export interface CursorBroadcastMessage {
    type: 'cursor:broadcast';
    userId: string;
    position: Point;
    pageId: string;
}

export interface ParticipantJoinedMessage {
    type: 'participant:joined';
    userId: string;
    displayName: string;
    color: string;
}

export interface ParticipantLeftMessage {
    type: 'participant:left';
    userId: string;
}

export interface RateLimitedMessage {
    type: 'rate-limited';
    retryAfterMs: number;
}

export interface ErrorMessage {
    type: 'error';
    code: string;
    message: string;
}

export interface PongMessage {
    type: 'pong';
    timestamp: number;
    serverTime: number;
}

export type ServerMessage =
    | JoinedMessage
    | SyncDeltaMessage
    | SyncFullMessage
    | MutationAckMessage
    | MutationBroadcastMessage
    | CursorBroadcastMessage
    | ParticipantJoinedMessage
    | ParticipantLeftMessage
    | RateLimitedMessage
    | ErrorMessage
    | PongMessage;
