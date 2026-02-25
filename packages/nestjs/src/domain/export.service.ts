import { Injectable } from '@nestjs/common';
import type {
    Element,
    StrokeElement,
    ShapeElement,
    TextElement,
    ImageElement,
    StickyNoteElement,
    Point,
    Rect,
} from '@hfu.digital/boardkit-core';
import type { Page } from '@hfu.digital/boardkit-core';
import { BoardStorage } from '../interfaces/board-storage.interface';

export type ExportFormat = 'png' | 'pdf' | 'svg';

// ── Structural types for server-side canvas (host app provides the impl) ──

/** Structural type for a server-side canvas factory. The host app provides this. */
export interface ServerCanvasFactory {
    createCanvas(width: number, height: number): ServerCanvas;
}

export interface ServerCanvas {
    getContext(type: '2d'): ServerCanvasContext;
    toBuffer(mimeType: 'image/png'): Buffer;
    toDataURL(mimeType: 'image/png'): string;
}

export interface ServerCanvasContext {
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    lineCap: string;
    lineJoin: string;
    font: string;
    textAlign: string;
    textBaseline: string;
    globalAlpha: number;
    save(): void;
    restore(): void;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(
        x: number,
        y: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        counterclockwise?: boolean,
    ): void;
    rect(x: number, y: number, width: number, height: number): void;
    fill(): void;
    stroke(): void;
    fillRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    fillText(text: string, x: number, y: number): void;
    translate(x: number, y: number): void;
    scale(x: number, y: number): void;
    rotate(angle: number): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    ellipse?(
        x: number,
        y: number,
        radiusX: number,
        radiusY: number,
        rotation: number,
        startAngle: number,
        endAngle: number,
    ): void;
}

// These are opaque types -- the host canvas lib provides them
type CanvasGradient = unknown;
type CanvasPattern = unknown;

// ── Constants ──

const EXPORT_PADDING = 40;
const DEFAULT_CANVAS_SIZE = 800;

// ── Service ──

@Injectable()
export class ExportService {
    private canvasFactory: ServerCanvasFactory | null = null;

    constructor(private readonly storage: BoardStorage) {}

    /**
     * Provide a server-side canvas factory (e.g. wrapping node-canvas).
     * Must be called before any PNG or PDF export.
     */
    setCanvasFactory(factory: ServerCanvasFactory): void {
        this.canvasFactory = factory;
    }

    async exportBoard(
        boardId: string,
        format: ExportFormat,
        pageIds?: string[],
    ): Promise<Buffer> {
        const allPages = await this.storage.getPages(boardId);
        const targetPages = pageIds
            ? allPages.filter((p) => pageIds.includes(p.id))
            : allPages;

        if (targetPages.length === 0) {
            throw new Error('No pages to export');
        }

        if (format === 'svg') {
            return this.exportSvg(targetPages);
        }

        if (format === 'png') {
            return this.exportPng(targetPages);
        }

        if (format === 'pdf') {
            return this.exportPdf(targetPages);
        }

        throw new Error(`Unsupported format: ${format}`);
    }

    // ── PNG export ──────────────────────────────────────────────────────

    private async exportPng(pages: Page[]): Promise<Buffer> {
        if (!this.canvasFactory) {
            throw new Error(
                'Server-side rendering not configured. Call setCanvasFactory() with a canvas implementation (e.g., node-canvas).',
            );
        }

        // For PNG we only export the first page
        const page = pages[0];
        const elements = await this.storage.getElements(page.id);

        const bbox = this.computeBoundingBox(elements);
        const width = Math.max(bbox.width + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);
        const height = Math.max(bbox.height + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);

        const canvas = this.canvasFactory.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Translate so that content starts at padding offset
        ctx.save();
        ctx.translate(EXPORT_PADDING - bbox.x, EXPORT_PADDING - bbox.y);

        // Sort by zIndex for correct layer order
        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        for (const element of sorted) {
            this.renderElementToCanvas(ctx, element);
        }

        ctx.restore();

        return canvas.toBuffer('image/png');
    }

    // ── SVG export ──────────────────────────────────────────────────────

    private async exportSvg(pages: Page[]): Promise<Buffer> {
        // Export first page as SVG (same single-page approach as PNG)
        const page = pages[0];
        const elements = await this.storage.getElements(page.id);

        const bbox = this.computeBoundingBox(elements);
        const width = Math.max(bbox.width + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);
        const height = Math.max(bbox.height + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);

        const offsetX = EXPORT_PADDING - bbox.x;
        const offsetY = EXPORT_PADDING - bbox.y;

        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        const svgContent = sorted
            .map((el) => this.renderElementToSvg(el, offsetX, offsetY))
            .join('\n');

        const svg = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
            `  <rect width="${width}" height="${height}" fill="#ffffff" />`,
            `  <g>`,
            svgContent,
            `  </g>`,
            `</svg>`,
        ].join('\n');

        return Buffer.from(svg, 'utf-8');
    }

    // ── PDF export ──────────────────────────────────────────────────────

    private async exportPdf(_pages: Page[]): Promise<Buffer> {
        throw new Error(
            'PDF export requires a PDF library (e.g., pdfkit). ' +
            'Provide a PDF renderer or use PNG/SVG format instead.',
        );
    }

    // ── Bounding box calculation ────────────────────────────────────────

    private computeBoundingBox(elements: Element[]): Rect {
        if (elements.length === 0) {
            return { x: 0, y: 0, width: DEFAULT_CANVAS_SIZE, height: DEFAULT_CANVAS_SIZE };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const el of elements) {
            const bounds = this.getElementBounds(el);
            if (!bounds) continue;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        }

        if (!isFinite(minX)) {
            return { x: 0, y: 0, width: DEFAULT_CANVAS_SIZE, height: DEFAULT_CANVAS_SIZE };
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    private getElementBounds(element: Element): Rect | null {
        switch (element.type) {
            case 'stroke':
                return element.data.bounds;
            case 'shape':
                return element.data.bounds;
            case 'text':
                return element.data.bounds;
            case 'image':
                return element.data.bounds;
            case 'stickyNote':
                return element.data.bounds;
            case 'group':
                return element.data.bounds;
            default:
                return null;
        }
    }

    // ── Canvas element rendering ────────────────────────────────────────

    private renderElementToCanvas(ctx: ServerCanvasContext, element: Element): void {
        switch (element.type) {
            case 'stroke':
                this.renderStrokeToCanvas(ctx, element);
                break;
            case 'shape':
                this.renderShapeToCanvas(ctx, element);
                break;
            case 'text':
                this.renderTextToCanvas(ctx, element);
                break;
            case 'image':
                this.renderImageToCanvas(ctx, element);
                break;
            case 'stickyNote':
                this.renderStickyNoteToCanvas(ctx, element);
                break;
            case 'group':
                // Groups are virtual containers; children render independently
                break;
        }
    }

    private renderStrokeToCanvas(ctx: ServerCanvasContext, element: StrokeElement): void {
        const { points, style } = element.data;
        if (points.length < 2) return;

        ctx.save();
        ctx.globalAlpha = style.opacity;
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.lineCap = style.lineCap;
        ctx.lineJoin = style.lineJoin;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    private renderShapeToCanvas(ctx: ServerCanvasContext, element: ShapeElement): void {
        const { shapeType, position, size, rotation, style } = element.data;
        const { stroke, fill } = style;

        ctx.save();

        // Apply rotation around center
        const cx = position.x + size.width / 2;
        const cy = position.y + size.height / 2;
        if (rotation !== 0) {
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.translate(-cx, -cy);
        }

        switch (shapeType) {
            case 'rectangle':
                this.applyFill(ctx, fill);
                if (fill.type === 'solid') {
                    ctx.fillRect(position.x, position.y, size.width, size.height);
                }
                this.applyStroke(ctx, stroke);
                ctx.strokeRect(position.x, position.y, size.width, size.height);
                break;

            case 'ellipse':
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(
                        cx,
                        cy,
                        size.width / 2,
                        size.height / 2,
                        0,
                        0,
                        Math.PI * 2,
                    );
                } else {
                    // Fallback: approximate ellipse with arc + scale
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(size.width / 2, size.height / 2);
                    ctx.arc(0, 0, 1, 0, Math.PI * 2);
                    ctx.restore();
                }
                this.applyFill(ctx, fill);
                if (fill.type === 'solid') {
                    ctx.fill();
                }
                this.applyStroke(ctx, stroke);
                ctx.stroke();
                break;

            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(position.x + size.width / 2, position.y);
                ctx.lineTo(position.x + size.width, position.y + size.height);
                ctx.lineTo(position.x, position.y + size.height);
                ctx.closePath();
                this.applyFill(ctx, fill);
                if (fill.type === 'solid') {
                    ctx.fill();
                }
                this.applyStroke(ctx, stroke);
                ctx.stroke();
                break;

            case 'line':
                this.applyStroke(ctx, stroke);
                ctx.beginPath();
                ctx.moveTo(position.x, position.y + size.height / 2);
                ctx.lineTo(position.x + size.width, position.y + size.height / 2);
                ctx.stroke();
                break;

            case 'arrow': {
                this.applyStroke(ctx, stroke);
                const startX = position.x;
                const startY = position.y + size.height / 2;
                const endX = position.x + size.width;
                const endY = position.y + size.height / 2;
                const headLen = Math.min(12, size.width * 0.3);
                const angle = Math.atan2(endY - startY, endX - startX);

                // Line
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Arrowhead
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - headLen * Math.cos(angle - Math.PI / 6),
                    endY - headLen * Math.sin(angle - Math.PI / 6),
                );
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - headLen * Math.cos(angle + Math.PI / 6),
                    endY - headLen * Math.sin(angle + Math.PI / 6),
                );
                ctx.stroke();
                break;
            }
        }

        ctx.restore();
    }

    private renderTextToCanvas(ctx: ServerCanvasContext, element: TextElement): void {
        const { content, position, style } = element.data;

        ctx.save();
        ctx.fillStyle = style.color;
        ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'top';

        const x =
            style.textAlign === 'center'
                ? position.x + element.data.size.width / 2
                : style.textAlign === 'right'
                    ? position.x + element.data.size.width
                    : position.x;

        // Simple multi-line split
        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, position.y + i * lineHeight);
        }

        ctx.restore();
    }

    private renderImageToCanvas(ctx: ServerCanvasContext, element: ImageElement): void {
        const { position, size } = element.data;

        // Placeholder: draw a light gray box with an X since we cannot load
        // images server-side without additional dependencies
        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(position.x, position.y, size.width, size.height);
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.strokeRect(position.x, position.y, size.width, size.height);

        // Draw X
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(position.x + size.width, position.y + size.height);
        ctx.moveTo(position.x + size.width, position.y);
        ctx.lineTo(position.x, position.y + size.height);
        ctx.stroke();

        ctx.restore();
    }

    private renderStickyNoteToCanvas(
        ctx: ServerCanvasContext,
        element: StickyNoteElement,
    ): void {
        const { content, position, size, color, style } = element.data;

        ctx.save();

        // Colored background
        ctx.fillStyle = color;
        ctx.fillRect(position.x, position.y, size.width, size.height);

        // Border
        ctx.strokeStyle = '#00000022';
        ctx.lineWidth = 1;
        ctx.strokeRect(position.x, position.y, size.width, size.height);

        // Text
        ctx.fillStyle = style.color;
        ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'top';

        const textPadding = 8;
        const x =
            style.textAlign === 'center'
                ? position.x + size.width / 2
                : style.textAlign === 'right'
                    ? position.x + size.width - textPadding
                    : position.x + textPadding;

        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, position.y + textPadding + i * lineHeight);
        }

        ctx.restore();
    }

    // ── SVG element rendering ───────────────────────────────────────────

    private renderElementToSvg(
        element: Element,
        offsetX: number,
        offsetY: number,
    ): string {
        switch (element.type) {
            case 'stroke':
                return this.renderStrokeToSvg(element, offsetX, offsetY);
            case 'shape':
                return this.renderShapeToSvg(element, offsetX, offsetY);
            case 'text':
                return this.renderTextToSvg(element, offsetX, offsetY);
            case 'image':
                return this.renderImageToSvg(element, offsetX, offsetY);
            case 'stickyNote':
                return this.renderStickyNoteToSvg(element, offsetX, offsetY);
            case 'group':
                return '';
            default:
                return '';
        }
    }

    private renderStrokeToSvg(
        element: StrokeElement,
        offsetX: number,
        offsetY: number,
    ): string {
        const { points, style } = element.data;
        if (points.length < 2) return '';

        const d = points
            .map((p, i) => {
                const cmd = i === 0 ? 'M' : 'L';
                return `${cmd}${p.x + offsetX},${p.y + offsetY}`;
            })
            .join(' ');

        return (
            `    <path d="${d}" ` +
            `fill="none" ` +
            `stroke="${this.escapeAttr(style.color)}" ` +
            `stroke-width="${style.width}" ` +
            `stroke-opacity="${style.opacity}" ` +
            `stroke-linecap="${style.lineCap}" ` +
            `stroke-linejoin="${style.lineJoin}" />`
        );
    }

    private renderShapeToSvg(
        element: ShapeElement,
        offsetX: number,
        offsetY: number,
    ): string {
        const { shapeType, position, size, rotation, style } = element.data;
        const { stroke, fill } = style;

        const cx = position.x + offsetX + size.width / 2;
        const cy = position.y + offsetY + size.height / 2;
        const transform = rotation !== 0 ? ` transform="rotate(${(rotation * 180) / Math.PI},${cx},${cy})"` : '';

        const fillAttr = fill.type === 'solid'
            ? `fill="${this.escapeAttr(fill.color)}" fill-opacity="${fill.opacity}"`
            : 'fill="none"';
        const strokeAttr =
            `stroke="${this.escapeAttr(stroke.color)}" ` +
            `stroke-width="${stroke.width}" ` +
            `stroke-opacity="${stroke.opacity}" ` +
            `stroke-linecap="${stroke.lineCap}" ` +
            `stroke-linejoin="${stroke.lineJoin}"`;

        switch (shapeType) {
            case 'rectangle':
                return (
                    `    <rect x="${position.x + offsetX}" y="${position.y + offsetY}" ` +
                    `width="${size.width}" height="${size.height}" ` +
                    `${fillAttr} ${strokeAttr}${transform} />`
                );

            case 'ellipse':
                return (
                    `    <ellipse cx="${cx}" cy="${cy}" ` +
                    `rx="${size.width / 2}" ry="${size.height / 2}" ` +
                    `${fillAttr} ${strokeAttr}${transform} />`
                );

            case 'triangle': {
                const x0 = position.x + offsetX;
                const y0 = position.y + offsetY;
                const pts = [
                    `${x0 + size.width / 2},${y0}`,
                    `${x0 + size.width},${y0 + size.height}`,
                    `${x0},${y0 + size.height}`,
                ].join(' ');
                return (
                    `    <polygon points="${pts}" ` +
                    `${fillAttr} ${strokeAttr}${transform} />`
                );
            }

            case 'line': {
                const x1 = position.x + offsetX;
                const y1 = position.y + offsetY + size.height / 2;
                const x2 = position.x + offsetX + size.width;
                const y2 = y1;
                return (
                    `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
                    `${strokeAttr}${transform} />`
                );
            }

            case 'arrow': {
                const ax1 = position.x + offsetX;
                const ay1 = position.y + offsetY + size.height / 2;
                const ax2 = position.x + offsetX + size.width;
                const ay2 = ay1;
                const headLen = Math.min(12, size.width * 0.3);
                const angle = Math.atan2(ay2 - ay1, ax2 - ax1);

                const ah1x = ax2 - headLen * Math.cos(angle - Math.PI / 6);
                const ah1y = ay2 - headLen * Math.sin(angle - Math.PI / 6);
                const ah2x = ax2 - headLen * Math.cos(angle + Math.PI / 6);
                const ah2y = ay2 - headLen * Math.sin(angle + Math.PI / 6);

                return [
                    `    <line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" ${strokeAttr}${transform} />`,
                    `    <line x1="${ax2}" y1="${ay2}" x2="${ah1x}" y2="${ah1y}" ${strokeAttr}${transform} />`,
                    `    <line x1="${ax2}" y1="${ay2}" x2="${ah2x}" y2="${ah2y}" ${strokeAttr}${transform} />`,
                ].join('\n');
            }

            default:
                return '';
        }
    }

    private renderTextToSvg(
        element: TextElement,
        offsetX: number,
        offsetY: number,
    ): string {
        const { content, position, size, style } = element.data;

        const anchor =
            style.textAlign === 'center'
                ? 'middle'
                : style.textAlign === 'right'
                    ? 'end'
                    : 'start';

        const x =
            style.textAlign === 'center'
                ? position.x + offsetX + size.width / 2
                : style.textAlign === 'right'
                    ? position.x + offsetX + size.width
                    : position.x + offsetX;

        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        const fontStyleAttr = style.fontStyle === 'italic' ? ' font-style="italic"' : '';

        const tspans = lines
            .map(
                (line, i) =>
                    `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`,
            )
            .join('');

        return (
            `    <text x="${x}" y="${position.y + offsetY + style.fontSize}" ` +
            `fill="${this.escapeAttr(style.color)}" ` +
            `font-family="${this.escapeAttr(style.fontFamily)}" ` +
            `font-size="${style.fontSize}" ` +
            `font-weight="${style.fontWeight}"${fontStyleAttr} ` +
            `text-anchor="${anchor}">` +
            tspans +
            `</text>`
        );
    }

    private renderImageToSvg(
        element: ImageElement,
        offsetX: number,
        offsetY: number,
    ): string {
        const { position, size } = element.data;
        const x = position.x + offsetX;
        const y = position.y + offsetY;

        // Placeholder rectangle with X since we cannot embed the image data
        return [
            `    <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1" />`,
            `    <line x1="${x}" y1="${y}" x2="${x + size.width}" y2="${y + size.height}" stroke="#9ca3af" stroke-width="1" />`,
            `    <line x1="${x + size.width}" y1="${y}" x2="${x}" y2="${y + size.height}" stroke="#9ca3af" stroke-width="1" />`,
        ].join('\n');
    }

    private renderStickyNoteToSvg(
        element: StickyNoteElement,
        offsetX: number,
        offsetY: number,
    ): string {
        const { content, position, size, color, style } = element.data;
        const x = position.x + offsetX;
        const y = position.y + offsetY;

        const textPadding = 8;
        const anchor =
            style.textAlign === 'center'
                ? 'middle'
                : style.textAlign === 'right'
                    ? 'end'
                    : 'start';
        const textX =
            style.textAlign === 'center'
                ? x + size.width / 2
                : style.textAlign === 'right'
                    ? x + size.width - textPadding
                    : x + textPadding;

        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        const fontStyleAttr = style.fontStyle === 'italic' ? ' font-style="italic"' : '';

        const tspans = lines
            .map(
                (line, i) =>
                    `<tspan x="${textX}" dy="${i === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`,
            )
            .join('');

        return [
            `    <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" fill="${this.escapeAttr(color)}" stroke="rgba(0,0,0,0.13)" stroke-width="1" />`,
            `    <text x="${textX}" y="${y + textPadding + style.fontSize}" ` +
                `fill="${this.escapeAttr(style.color)}" ` +
                `font-family="${this.escapeAttr(style.fontFamily)}" ` +
                `font-size="${style.fontSize}" ` +
                `font-weight="${style.fontWeight}"${fontStyleAttr} ` +
                `text-anchor="${anchor}">` +
                tspans +
                `</text>`,
        ].join('\n');
    }

    // ── Helpers for fill/stroke application (canvas) ────────────────────

    private applyFill(
        ctx: ServerCanvasContext,
        fill: { type: 'solid' | 'none'; color: string; opacity: number },
    ): void {
        if (fill.type === 'solid') {
            ctx.globalAlpha = fill.opacity;
            ctx.fillStyle = fill.color;
        }
    }

    private applyStroke(
        ctx: ServerCanvasContext,
        stroke: {
            color: string;
            width: number;
            opacity: number;
            lineCap: string;
            lineJoin: string;
        },
    ): void {
        ctx.globalAlpha = stroke.opacity;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = stroke.lineCap;
        ctx.lineJoin = stroke.lineJoin;
    }

    // ── XML / SVG escape helpers ────────────────────────────────────────

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private escapeAttr(str: string): string {
        return this.escapeXml(str);
    }
}
