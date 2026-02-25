import React, { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import { ToolRegistry } from '@hfu.digital/boardkit-core';
import { BoardStore } from '../store/board-store';
import { Canvas2DRenderer } from '../engine/canvas-2d-renderer';

export interface BoardKitTheme {
    selectionColor: string;
    handleColor: string;
    cursorLabelFont: string;
}

export interface BoardKitConfig {
    apiUrl: string;
    wsUrl?: string;
    authToken?: string;
    theme?: Partial<BoardKitTheme>;
}

export interface BoardKitContextValue {
    store: BoardStore;
    renderer: Canvas2DRenderer;
    toolRegistry: ToolRegistry;
    config: BoardKitConfig;
}

const BoardKitContext = createContext<BoardKitContextValue | null>(null);

export function useBoardKit(): BoardKitContextValue {
    const ctx = useContext(BoardKitContext);
    if (!ctx) {
        throw new Error('useBoardKit must be used within a BoardKitProvider');
    }
    return ctx;
}

export interface BoardKitProviderProps {
    config: BoardKitConfig;
    children: React.ReactNode;
}

export function BoardKitProvider({ config, children }: BoardKitProviderProps) {
    const storeRef = useRef<BoardStore | null>(null);
    const rendererRef = useRef<Canvas2DRenderer | null>(null);
    const toolRegistryRef = useRef<ToolRegistry | null>(null);

    if (!storeRef.current) {
        storeRef.current = new BoardStore();
    }
    if (!rendererRef.current) {
        rendererRef.current = new Canvas2DRenderer();
    }
    if (!toolRegistryRef.current) {
        toolRegistryRef.current = ToolRegistry.createDefault();
    }

    const value = useMemo<BoardKitContextValue>(
        () => ({
            store: storeRef.current!,
            renderer: rendererRef.current!,
            toolRegistry: toolRegistryRef.current!,
            config,
        }),
        [config],
    );

    useEffect(() => {
        return () => {
            rendererRef.current?.destroy();
        };
    }, []);

    return (
        <BoardKitContext.Provider value={value}>
            {children}
        </BoardKitContext.Provider>
    );
}
