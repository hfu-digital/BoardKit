import { useState, useEffect, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseToolResult {
    activeTool: string;
    setTool: (toolId: string) => void;
    toolConfig: Record<string, unknown>;
    setToolConfig: (config: Record<string, unknown>) => void;
}

export function useTool(): UseToolResult {
    const { store } = useBoardKit();
    const [activeTool, setActiveTool] = useState(store.getState().activeTool);
    const [toolConfig, setToolConfigState] = useState(store.getState().toolConfig);

    useEffect(() => {
        return store.subscribe('tool', () => {
            setActiveTool(store.getState().activeTool);
            setToolConfigState(store.getState().toolConfig);
        });
    }, [store]);

    const setTool = useCallback(
        (toolId: string) => {
            store.setActiveTool(toolId);
        },
        [store],
    );

    const setToolConfig = useCallback(
        (config: Record<string, unknown>) => {
            store.setToolConfig(config);
        },
        [store],
    );

    return { activeTool, setTool, toolConfig, setToolConfig };
}
