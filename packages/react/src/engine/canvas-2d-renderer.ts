import type {
    AlignmentGuide,
    BindingPreview,
    Element,
    Rect,
} from '@hfu.digital/boardkit-core';
import type { CursorPosition } from '@hfu.digital/boardkit-core';
import { BoardRenderer, type RenderContext } from '@hfu.digital/boardkit-core';
import { renderStaticLayer } from './static-layer';
import { renderInteractiveLayer } from './interactive-layer';

export class Canvas2DRenderer extends BoardRenderer {
    private container: HTMLElement | null = null;
    private staticCanvas: HTMLCanvasElement | null = null;
    private interactiveCanvas: HTMLCanvasElement | null = null;
    private staticCtx: CanvasRenderingContext2D | null = null;
    private interactiveCtx: CanvasRenderingContext2D | null = null;
    private animFrameId: number | null = null;
    private sceneNonce = 0;
    private lastRenderedNonce = -1;
    private elements: Element[] = [];
    private elementsMap = new Map<string, Element>();
    private participantColors = new Map<string, { color: string; name: string }>();

    // Interactive layer state - updated every frame
    private preview: Element[] = [];
    private cursors: CursorPosition[] = [];
    private selections: Rect[] = [];
    private selectedIds = new Set<string>();
    private bindingPreviews: BindingPreview[] = [];
    private alignmentGuides: AlignmentGuide[] = [];
    private renderContext: RenderContext = {
        viewport: { offset: { x: 0, y: 0 }, zoom: 1 },
        selectedIds: new Set(),
        activeTool: 'pen',
    };

    initialize(container: HTMLElement): void {
        this.container = container;

        this.staticCanvas = document.createElement('canvas');
        this.interactiveCanvas = document.createElement('canvas');

        this.staticCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
        this.interactiveCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:auto';

        container.style.position = 'relative';
        container.appendChild(this.staticCanvas);
        container.appendChild(this.interactiveCanvas);

        this.staticCtx = this.staticCanvas.getContext('2d')!;
        this.interactiveCtx = this.interactiveCanvas.getContext('2d')!;

        this.resize(container.clientWidth, container.clientHeight);
        this.startRenderLoop();
    }

    resize(width: number, height: number): void {
        const dpr = window.devicePixelRatio || 1;
        for (const canvas of [this.staticCanvas, this.interactiveCanvas]) {
            if (canvas) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                const ctx = canvas.getContext('2d');
                ctx?.scale(dpr, dpr);
            }
        }
        this.invalidateScene();
    }

    renderStaticLayer(elements: Element[], context: RenderContext): void {
        this.elements = elements;
        this.elementsMap.clear();
        for (const el of elements) {
            this.elementsMap.set(el.id, el);
        }
        this.renderContext = context;
        this.selectedIds = context.selectedIds;
        this.invalidateScene();
    }

    renderInteractiveLayer(
        preview: Element[],
        cursors: CursorPosition[],
        selections: Rect[],
        context: RenderContext,
        bindingPreviews: BindingPreview[] = [],
        alignmentGuides: AlignmentGuide[] = [],
    ): void {
        this.preview = preview;
        this.cursors = cursors;
        this.selections = selections;
        this.renderContext = context;
        this.selectedIds = context.selectedIds;
        this.bindingPreviews = bindingPreviews;
        this.alignmentGuides = alignmentGuides;
    }

    setParticipantColors(colors: Map<string, { color: string; name: string }>): void {
        this.participantColors = colors;
    }

    getInteractiveCanvas(): HTMLCanvasElement | null {
        return this.interactiveCanvas;
    }

    destroy(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.staticCanvas?.remove();
        this.interactiveCanvas?.remove();
        this.staticCanvas = null;
        this.interactiveCanvas = null;
        this.staticCtx = null;
        this.interactiveCtx = null;
        this.container = null;
    }

    toDataURL(format = 'image/png', quality = 1.0): string {
        return this.staticCanvas?.toDataURL(format, quality) ?? '';
    }

    invalidateScene(): void {
        this.sceneNonce++;
    }

    private startRenderLoop(): void {
        const loop = () => {
            this.animFrameId = requestAnimationFrame(loop);

            // Static layer: only re-render when scene changes
            if (this.sceneNonce !== this.lastRenderedNonce && this.staticCtx) {
                renderStaticLayer(
                    this.staticCtx,
                    this.elements,
                    this.renderContext.viewport,
                    this.elementsMap,
                );
                this.lastRenderedNonce = this.sceneNonce;
            }

            // Interactive layer: every frame
            if (this.interactiveCtx) {
                renderInteractiveLayer(
                    this.interactiveCtx,
                    this.preview,
                    this.cursors,
                    this.selections,
                    this.selectedIds,
                    this.elementsMap,
                    this.renderContext.viewport,
                    this.participantColors,
                    this.bindingPreviews,
                    this.alignmentGuides,
                );
            }
        };
        this.animFrameId = requestAnimationFrame(loop);
    }
}
