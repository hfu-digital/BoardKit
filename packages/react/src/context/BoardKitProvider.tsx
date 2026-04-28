import React, { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import { ToolRegistry } from '@hfu.digital/boardkit-core';
import { BoardStore } from '../store/board-store';
import { Canvas2DRenderer } from '../engine/canvas-2d-renderer';
import { configureAssetResolver, resetAssetResolver } from '../engine/asset-resolver';

export interface BoardKitTheme {
    selectionColor: string;
    handleColor: string;
    cursorLabelFont: string;
}

export interface BoardKitConfig {
    apiUrl: string;
    wsUrl?: string;
    authToken?: string;
    /**
     * Authenticated user id. Stamped on element.createdBy when tools emit
     * `create` mutations so the server (and other clients) can attribute
     * the element. Without it, createdBy is empty string and attribution
     * is lost — the row still saves.
     */
    userId?: string;
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

    // Re-configure the asset resolver on every config change so authToken
    // refreshes (and apiUrl swaps in tests) reach the renderer. The resolver
    // re-reads the token via the closure on every fetch, so identity-stable
    // refs aren't required.
    useEffect(() => {
        configureAssetResolver({
            apiUrl: config.apiUrl,
            getAuthToken: () => config.authToken,
        });
    }, [config.apiUrl, config.authToken]);

    useEffect(() => {
        return () => {
            rendererRef.current?.destroy();
            resetAssetResolver();
        };
    }, []);

    return (
        <BoardKitContext.Provider value={value}>
            {children}
        </BoardKitContext.Provider>
    );
}
