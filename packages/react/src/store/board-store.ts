import type {
    Board,
    Page,
    Element,
    Participant,
    CursorPosition,
    SceneState,
    GridConfig,
} from '@boardkit/core';
import { History, createScene, createDefaultGridConfig } from '@boardkit/core';
import type { ViewportState } from '../engine/viewport';
import { createViewport } from '../engine/viewport';

export interface BoardError {
    code: string;
    message: string;
    timestamp: number;
    recoverable: boolean;
}

export interface BoardStoreState {
    board: Board | null;
    pages: Page[];
    activePageId: string | null;
    scene: SceneState;
    viewport: ViewportState;
    activeTool: string;
    toolConfig: Record<string, unknown>;
    selectedIds: Set<string>;
    hoveredId: string | null;
    history: History;
    participants: Map<string, Participant>;
    cursors: Map<string, CursorPosition>;
    lastError: BoardError | null;
    gridConfig: GridConfig;
}

export type StoreSlice =
    | 'board'
    | 'pages'
    | 'scene'
    | 'viewport'
    | 'tool'
    | 'selection'
    | 'participants'
    | 'cursors'
    | 'error'
    | 'grid';

export class BoardStore {
    private state: BoardStoreState;
    private listeners = new Map<string, Set<() => void>>();

    constructor() {
        this.state = {
            board: null,
            pages: [],
            activePageId: null,
            scene: createScene(),
            viewport: createViewport(),
            activeTool: 'pen',
            toolConfig: {},
            selectedIds: new Set(),
            hoveredId: null,
            history: new History(100),
            participants: new Map(),
            cursors: new Map(),
            lastError: null,
            gridConfig: createDefaultGridConfig(),
        };
    }

    getState(): BoardStoreState {
        return this.state;
    }

    // Board data
    setBoard(board: Board | null): void {
        this.state.board = board;
        this.notify('board');
    }

    setPages(pages: Page[]): void {
        this.state.pages = pages;
        this.notify('pages');
    }

    setActivePageId(pageId: string | null): void {
        this.state.activePageId = pageId;
        this.notify('pages');
    }

    // Scene mutations
    updateScene(fn: (scene: SceneState) => SceneState): void {
        this.state.scene = fn(this.state.scene);
        this.notify('scene');
    }

    // Viewport mutations
    updateViewport(fn: (vp: ViewportState) => ViewportState): void {
        this.state.viewport = fn(this.state.viewport);
        this.notify('viewport');
    }

    // Tool state
    setActiveTool(toolId: string): void {
        this.state.activeTool = toolId;
        this.notify('tool');
    }

    setToolConfig(config: Record<string, unknown>): void {
        this.state.toolConfig = { ...this.state.toolConfig, ...config };
        this.notify('tool');
    }

    // Selection
    setSelection(ids: Set<string>): void {
        this.state.selectedIds = ids;
        this.notify('selection');
    }

    setHoveredId(id: string | null): void {
        this.state.hoveredId = id;
        this.notify('selection');
    }

    // Collaboration
    setParticipants(participants: Map<string, Participant>): void {
        this.state.participants = participants;
        this.notify('participants');
    }

    updateCursor(userId: string, cursor: CursorPosition): void {
        this.state.cursors.set(userId, cursor);
        this.notify('cursors');
    }

    removeCursor(userId: string): void {
        this.state.cursors.delete(userId);
        this.notify('cursors');
    }

    // Grid config
    setGridConfig(config: Partial<GridConfig>): void {
        this.state.gridConfig = { ...this.state.gridConfig, ...config };
        this.notify('grid');
    }

    // Error state
    setError(error: BoardError | null): void {
        this.state.lastError = error;
        this.notify('error');
    }

    // Pub/sub
    subscribe(slice: string, listener: () => void): () => void {
        if (!this.listeners.has(slice)) {
            this.listeners.set(slice, new Set());
        }
        this.listeners.get(slice)!.add(listener);
        return () => {
            this.listeners.get(slice)?.delete(listener);
        };
    }

    private notify(slice: string): void {
        const listeners = this.listeners.get(slice);
        if (listeners) {
            for (const listener of listeners) {
                listener();
            }
        }
    }
}
