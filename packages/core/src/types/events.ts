import type { Element } from './elements';

export type BoardEventType =
    | 'elementCreated'
    | 'elementUpdated'
    | 'elementDeleted'
    | 'pageAdded'
    | 'pageRemoved'
    | 'pageReordered'
    | 'boardUpdated';

export interface BoardEvent {
    id: string;
    boardId: string;
    pageId?: string;
    type: BoardEventType;
    payload: Record<string, unknown>;
    userId: string;
    sequence: number;
    timestamp: string;
}

export interface BoardSnapshot {
    id: string;
    boardId: string;
    snapshotData: Record<string, unknown>;
    eventSequence: number;
    createdAt: string;
}

export interface ElementMutation {
    type: 'create' | 'update' | 'delete';
    elementId: string;
    pageId: string;
    data?: Partial<Element>;
    timestamp: number;
}
