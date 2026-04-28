import { useCallback, useEffect, useRef, useState } from 'react';
import {
    addElement,
    DEFAULT_TEXT_STYLE,
    TextTool,
} from '@hfu.digital/boardkit-core';
import type {
    ElementMutation,
    Point,
    TextElement,
    TextStyle,
    TextToolEvent,
} from '@hfu.digital/boardkit-core';
import { useBoardKit } from '../context/BoardKitProvider';
import { useElementMutations } from './useElementMutations';

let textIdCounter = 0;
function generateTextId(): string {
    return `text-${++textIdCounter}-${Date.now()}`;
}

export interface TextEditorSession {
    mode: 'create' | 'edit';
    /** Element id — generated up-front for create, existing id for edit. */
    elementId: string;
    /** World-space top-left for the textarea overlay. */
    position: Point;
    initialContent: string;
    style: Partial<TextStyle>;
    /** Existing element size (world units) — only set for edit. */
    initialSize?: { width: number; height: number };
}

export interface UseTextEditorResult {
    session: TextEditorSession | null;
    /**
     * Open an edit session for an existing text element. Called from
     * BoardCanvas's double-click handler (works regardless of active tool).
     */
    beginEditExternal: (elementId: string, position: Point) => void;
    /** Persist the current session's content. Empty + edit deletes the element. */
    commitText: (content: string) => void;
    /** Discard the session without persisting. */
    cancel: () => void;
}

/**
 * Bridge between the TextTool's intent events and the inline TextEditor
 * component. Mirrors the shape of useImageImport — the tool emits intent,
 * the hook persists. On commit, reverts the active tool to Select to match
 * Excalidraw / Figma muscle memory.
 *
 * Pass `readOnly` to skip wiring entirely on read-only boards.
 */
export function useTextEditor(options?: { readOnly?: boolean }): UseTextEditorResult {
    const readOnly = options?.readOnly ?? false;
    const { store, toolRegistry, config } = useBoardKit();
    const { patchElement, deleteElements } = useElementMutations();
    const [session, setSession] = useState<TextEditorSession | null>(null);
    // Synchronous mirror of `session` so the TextTool callback (which fires
    // from a pointer event before any pending React state flush) can see the
    // current session immediately. Without this, a quick click during an
    // active edit would race the blur-commit and clobber state.
    const sessionRef = useRef<TextEditorSession | null>(null);

    const updateSession = useCallback((next: TextEditorSession | null) => {
        sessionRef.current = next;
        setSession(next);
    }, []);

    // Subscribe to TextTool intent events. The tool already exists in the
    // registry — we just attach our callback. Cleanup nulls it so the hook
    // can be remounted without leaking the previous handler.
    useEffect(() => {
        if (readOnly) return;
        const tool = toolRegistry.get('text');
        if (!(tool instanceof TextTool)) return;

        const handler = (event: TextToolEvent) => {
            // If a session is already open, the textarea's pending blur will
            // commit it — ignore this intent. User clicks again to start a
            // new editor. Matches Excalidraw's "click away to commit" feel.
            if (sessionRef.current) return;
            if (event.type === 'createTextEditor') {
                updateSession({
                    mode: 'create',
                    elementId: generateTextId(),
                    position: event.position,
                    initialContent: '',
                    style: { ...DEFAULT_TEXT_STYLE },
                });
                return;
            }
            // editTextEditor — load the existing element
            const el = store.getState().scene.elements.get(event.elementId);
            if (!el || el.type !== 'text') return;
            updateSession({
                mode: 'edit',
                elementId: event.elementId,
                position: el.data.position,
                initialContent: el.data.content,
                style: { ...el.data.style },
                initialSize: { ...el.data.size },
            });
        };

        tool.onTextEvent = handler;
        return () => {
            if (tool.onTextEvent === handler) {
                tool.onTextEvent = undefined;
            }
        };
    }, [readOnly, store, toolRegistry, updateSession]);

    // Clear any open editor session when the active tool changes away from
    // 'text'. Without this, a rapid tool switch (e.g. user opens text editor
    // then immediately presses 'r' for rectangle) unmounts the textarea
    // before its blur fires, so commitText/cancel never run and sessionRef
    // stays stuck non-null — which then makes ALL future text-tool clicks
    // no-op via the early-return guard at the top of the TextTool handler.
    useEffect(() => {
        if (readOnly) return;
        return store.subscribe('tool', () => {
            const activeTool = store.getState().activeTool;
            if (activeTool !== 'text' && sessionRef.current) {
                updateSession(null);
            }
        });
    }, [readOnly, store, updateSession]);

    const beginEditExternal = useCallback(
        (elementId: string, _position: Point) => {
            if (readOnly) return;
            // Same race guard as the TextTool path — if a session is open,
            // ignore. Realistically a dblclick on already-being-edited text
            // shouldn't happen since the textarea overlays the element.
            if (sessionRef.current) return;
            const el = store.getState().scene.elements.get(elementId);
            if (!el || el.type !== 'text') return;
            updateSession({
                mode: 'edit',
                elementId,
                // Use the element's own position, not the click point — the
                // editor must overlay the rendered text, not float at the cursor.
                position: el.data.position,
                initialContent: el.data.content,
                style: { ...el.data.style },
                initialSize: { ...el.data.size },
            });
        },
        [readOnly, store, updateSession],
    );

    const commitText = useCallback(
        (content: string) => {
            if (!session) return;
            const trimmed = content.replace(/\s+$/g, '');
            const empty = trimmed.length === 0;

            if (session.mode === 'create') {
                if (empty) {
                    // Never created an element on the create-then-cancel path.
                    updateSession(null);
                    store.setActiveTool('select');
                    return;
                }
                const style = { ...DEFAULT_TEXT_STYLE, ...session.style } as TextStyle;
                const size = measureText(content, style);
                const now = new Date().toISOString();
                const pageId = store.getState().activePageId ?? '';
                const userId = config.userId ?? '';
                if (pageId === '') {
                    // Pages haven't loaded yet — the server's flushPending
                    // would silently drop a mutation with an empty pageId,
                    // so don't even create the element locally. The user
                    // will lose the keystrokes but the alternative is silent
                    // data loss on reload, which is worse.
                    // eslint-disable-next-line no-console
                    console.warn(
                        '[boardkit] dropped text creation: activePageId not loaded yet',
                    );
                    updateSession(null);
                    store.setActiveTool('select');
                    return;
                }
                const element: TextElement = {
                    id: session.elementId,
                    pageId,
                    type: 'text',
                    zIndex: Date.now(),
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now,
                    data: {
                        content,
                        position: session.position,
                        size,
                        rotation: 0,
                        style,
                        bounds: {
                            x: session.position.x,
                            y: session.position.y,
                            width: size.width,
                            height: size.height,
                        },
                    },
                };
                store.updateScene((scene) => addElement(scene, element));
                if (pageId !== '') {
                    const mutation: ElementMutation = {
                        type: 'create',
                        elementId: element.id,
                        pageId,
                        data: element,
                        timestamp: Date.now(),
                    };
                    store.enqueueOutboundMutations([mutation]);
                }
                updateSession(null);
                store.setActiveTool('select');
                return;
            }

            // edit
            if (empty) {
                deleteElements([session.elementId]);
                updateSession(null);
                store.setActiveTool('select');
                return;
            }
            const style = { ...DEFAULT_TEXT_STYLE, ...session.style } as TextStyle;
            const size = measureText(content, style);
            patchElement(session.elementId, {
                content,
                size,
                bounds: {
                    x: session.position.x,
                    y: session.position.y,
                    width: size.width,
                    height: size.height,
                },
            });
            setSession(null);
            store.setActiveTool('select');
        },
        [session, store, config.userId, patchElement, deleteElements, updateSession],
    );

    const cancel = useCallback(() => {
        if (!session) return;
        // For create, no element exists; for edit, leave the element untouched.
        // Always revert to select — matches the commit path and useImageImport.
        updateSession(null);
        store.setActiveTool('select');
    }, [session, store, updateSession]);

    return { session, beginEditExternal, commitText, cancel };
}

// --- text measurement -------------------------------------------------------

let measureCanvas: HTMLCanvasElement | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null;
    if (!measureCanvas) measureCanvas = document.createElement('canvas');
    return measureCanvas.getContext('2d');
}

/**
 * Compute the world-space size of `content` rendered with `style`. Matches the
 * rendering done by text.renderer.ts (lineHeight = fontSize * 1.3) so the
 * stored bounds align with what the user sees on canvas — critical for the
 * double-click hit-test on multi-line text and for selection-chrome
 * accuracy after font-size changes via PropertiesPanel.
 */
export function measureText(
    content: string,
    style: TextStyle,
): { width: number; height: number } {
    const lines = content.split('\n');
    const lineHeight = style.fontSize * 1.3;
    const height = Math.max(lineHeight, lines.length * lineHeight);
    const ctx = getMeasureContext();
    if (!ctx) {
        // SSR / no DOM fallback — pick a width proportional to the longest line.
        const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
        return { width: Math.max(40, longest * style.fontSize * 0.6), height };
    }
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    let maxWidth = 0;
    for (const line of lines) {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) maxWidth = metrics.width;
    }
    return { width: Math.max(40, Math.ceil(maxWidth)), height };
}
