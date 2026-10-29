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
import { createAssetResolver, type ResolverConfig } from './asset-resolver';
import { createImageCache, bindImageCache } from './element-renderers/image.renderer';

export class Canvas2DRenderer extends BoardRenderer {
    private container: HTMLElement | null = null;
    private staticCanvas: HTMLCanvasElement | null = null;
    private interactiveCanvas: HTMLCanvasElement | null = null;
    private staticCtx: CanvasRenderingContext2D | null = null;
    private interactiveCtx: CanvasRenderingContext2D | null = null;
    private animFrameId: number | null = null;
    private staticDirty = true;
    private interactiveDirty = true;
    private sceneImageUrls = new Set<string>();
    private resourcesDirty = true;
    private assetConfig?: ResolverConfig;
    private assets = createAssetResolver();
    private images = createImageCache(this.assets.getResolvedAssetUrl);
    private cleanup: (() => void)[] = [];
    private fontReady = () => this.invalidateScene();

    configureAssets(config: ResolverConfig): void {
        this.assetConfig = config;
        this.images.reset();
        this.assets.configureAssetResolver(config);
        this.invalidateScene();
    }
    private elements: Element[] = [];
    private elementsMap = new Map<string, Element>();
    private participantColors = new Map<string, { color: string; name: string }>();

    // Interactive layer state - painted only after invalidation
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
        if (this.container) this.destroy();
        this.container = container;
        if (this.assetConfig) this.assets.configureAssetResolver(this.assetConfig);

        this.staticCanvas = document.createElement('canvas');
        this.interactiveCanvas = document.createElement('canvas');

        this.staticCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
        this.interactiveCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:auto';

        container.style.position = 'relative';
        container.appendChild(this.staticCanvas);
        container.appendChild(this.interactiveCanvas);

        this.staticCtx = this.staticCanvas.getContext('2d')!;
        this.interactiveCtx = this.interactiveCanvas.getContext('2d')!;

        bindImageCache(this.staticCanvas, this.images);
        bindImageCache(this.interactiveCanvas, this.images);
        this.cleanup.push(this.assets.subscribeAssetReady(this.fontReady), this.images.subscribeImageReady(this.fontReady));
        document.fonts?.addEventListener('loadingdone', this.fontReady);
        document.fonts?.addEventListener('loadingerror', this.fontReady);
        // Fonts may already be loading before initialization.
        let active = true;
        document.fonts?.ready.then(() => { if (active) this.invalidateScene(); });
        this.cleanup.push(() => { active = false; });
        // A theme/filter change affects already-decoded image pixels too.
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(this.fontReady);
            for (let node: HTMLElement | null = container; node; node = node.parentElement) {
                observer.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
            }
            this.cleanup.push(() => observer.disconnect());
        }
        const resize = () => this.resize(container.clientWidth, container.clientHeight);
        window.addEventListener?.('resize', resize);
        this.cleanup.push(() => window.removeEventListener?.('resize', resize));
        this.resize(container.clientWidth, container.clientHeight);
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
        this.sceneImageUrls.clear();
        this.resourcesDirty = true;
        for (const el of elements) {
            this.elementsMap.set(el.id, el);
            if (el.type === 'image') this.sceneImageUrls.add(el.data.url);
        }
        this.renderContext = { ...context, viewport: { ...context.viewport, offset: { ...context.viewport.offset } } };
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
        const previous = this.renderContext.viewport;
        if (previous.zoom !== context.viewport.zoom || previous.offset.x !== context.viewport.offset.x || previous.offset.y !== context.viewport.offset.y) this.staticDirty = true;
        this.preview = preview;
        this.resourcesDirty = true;
        this.cursors = cursors;
        this.selections = selections;
        this.renderContext = { ...context, viewport: { ...context.viewport, offset: { ...context.viewport.offset } } };
        this.selectedIds = context.selectedIds;
        this.bindingPreviews = bindingPreviews;
        this.alignmentGuides = alignmentGuides;
        this.interactiveDirty = true;
        this.scheduleFrame();
    }

    setCursors(cursors: CursorPosition[]): void {
        this.cursors = cursors;
        this.interactiveDirty = true;
        this.scheduleFrame();
    }

    setParticipantColors(colors: Map<string, { color: string; name: string }>): void {
        this.participantColors = colors;
        this.interactiveDirty = true;
        this.scheduleFrame();
    }

    getInteractiveCanvas(): HTMLCanvasElement | null {
        return this.interactiveCanvas;
    }

    destroy(): void {
        for (const cleanup of this.cleanup.splice(0)) cleanup();
        document.fonts?.removeEventListener('loadingdone', this.fontReady);
        document.fonts?.removeEventListener('loadingerror', this.fontReady);
        this.images.reset();
        this.assets.resetAssetResolver(false);
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
        this.paint();
        return this.staticCanvas?.toDataURL(format, quality) ?? '';
    }

    invalidateScene(): void {
        this.staticDirty = true;
        this.interactiveDirty = true;
        this.scheduleFrame();
    }

    private scheduleFrame(): void {
        if (!this.container || this.animFrameId !== null) return;
        this.animFrameId = requestAnimationFrame(() => {
            this.animFrameId = null;
            this.paint();
        });
    }

    private paint(): void {
        if (this.resourcesDirty) {
            this.resourcesDirty = false;
            const urls = new Set(this.sceneImageUrls);
            for (const element of this.preview) if (element.type === 'image') urls.add(element.data.url);
            this.images.retain(urls);
            this.assets.retain(urls);
        }
        // Clear flags before drawing so synchronous readiness cannot be lost.
        const drawStatic = this.staticDirty;
        const drawInteractive = this.interactiveDirty;
        this.staticDirty = this.interactiveDirty = false;
        if (drawStatic && this.staticCtx) {
            renderStaticLayer(this.staticCtx, this.elements, this.renderContext.viewport, this.elementsMap);
        }
        if (drawInteractive && this.interactiveCtx) {
            renderInteractiveLayer(this.interactiveCtx, this.preview, this.cursors, this.selections,
                this.selectedIds, this.elementsMap, this.renderContext.viewport, this.participantColors,
                this.bindingPreviews, this.alignmentGuides);
        }
    }
}
