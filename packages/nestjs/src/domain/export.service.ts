import { Injectable } from '@nestjs/common';
import type {
    Element,
    StrokeElement,
    ShapeElement,
    LinearElement,
    TextElement,
    ImageElement,
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

        if (targetPages.length === 0) throw new Error('No pages to export');
        if (format === 'svg') return this.exportSvg(targetPages);
        if (format === 'png') return this.exportPng(targetPages);
        if (format === 'pdf') return this.exportPdf(targetPages);
        throw new Error(`Unsupported format: ${format}`);
    }

    // ── PNG export ──────────────────────────────────────────────────────

    private async exportPng(pages: Page[]): Promise<Buffer> {
        if (!this.canvasFactory) {
            throw new Error(
                'Server-side rendering not configured. Call setCanvasFactory() with a canvas implementation (e.g., node-canvas).',
            );
        }
        const page = pages[0];
        const elements = await this.storage.getElements(page.id);
        const bbox = this.computeBoundingBox(elements);
        const width = Math.max(bbox.width + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);
        const height = Math.max(bbox.height + EXPORT_PADDING * 2, DEFAULT_CANVAS_SIZE);

        const canvas = this.canvasFactory.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(EXPORT_PADDING - bbox.x, EXPORT_PADDING - bbox.y);

        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        for (const element of sorted) this.renderElementToCanvas(ctx, element);
        ctx.restore();
        return canvas.toBuffer('image/png');
    }

    // ── SVG export ──────────────────────────────────────────────────────

    private async exportSvg(pages: Page[]): Promise<Buffer> {
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

    private async exportPdf(_pages: Page[]): Promise<Buffer> {
        throw new Error(
            'PDF export requires a PDF library (e.g., pdfkit). ' +
            'Provide a PDF renderer or use PNG/SVG format instead.',
        );
    }

    // ── Bounding box ────────────────────────────────────────────────────

    private computeBoundingBox(elements: Element[]): Rect {
        if (elements.length === 0) {
            return { x: 0, y: 0, width: DEFAULT_CANVAS_SIZE, height: DEFAULT_CANVAS_SIZE };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of elements) {
            const bounds = el.data.bounds;
            if (!bounds) continue;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        }
        if (!isFinite(minX)) {
            return { x: 0, y: 0, width: DEFAULT_CANVAS_SIZE, height: DEFAULT_CANVAS_SIZE };
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // ── Canvas rendering ─────────────────────────────────────────────────

    private renderElementToCanvas(ctx: ServerCanvasContext, element: Element): void {
        switch (element.type) {
            case 'stroke':
                this.renderStrokeToCanvas(ctx, element);
                break;
            case 'shape':
                this.renderShapeToCanvas(ctx, element);
                break;
            case 'linear':
                this.renderLinearToCanvas(ctx, element);
                break;
            case 'text':
                this.renderTextToCanvas(ctx, element);
                break;
            case 'image':
                this.renderImageToCanvas(ctx, element);
                break;
            case 'group':
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
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();
    }

    private renderShapeToCanvas(ctx: ServerCanvasContext, element: ShapeElement): void {
        const { shapeType, position, size, rotation, style } = element.data;
        const { stroke, fill } = style;
        ctx.save();
        const cx = position.x + size.width / 2;
        const cy = position.y + size.height / 2;
        if (rotation !== 0) {
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.translate(-cx, -cy);
        }

        switch (shapeType) {
            case 'rectangle':
                if (fill.type !== 'none') {
                    this.applyFill(ctx, fill);
                    ctx.fillRect(position.x, position.y, size.width, size.height);
                }
                this.applyStroke(ctx, stroke);
                ctx.strokeRect(position.x, position.y, size.width, size.height);
                break;

            case 'diamond': {
                const x0 = position.x, y0 = position.y;
                const w = size.width, h = size.height;
                ctx.beginPath();
                ctx.moveTo(x0 + w / 2, y0);
                ctx.lineTo(x0 + w, y0 + h / 2);
                ctx.lineTo(x0 + w / 2, y0 + h);
                ctx.lineTo(x0, y0 + h / 2);
                ctx.closePath();
                if (fill.type !== 'none') {
                    this.applyFill(ctx, fill);
                    ctx.fill();
                }
                this.applyStroke(ctx, stroke);
                ctx.stroke();
                break;
            }

            case 'ellipse':
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(cx, cy, size.width / 2, size.height / 2, 0, 0, Math.PI * 2);
                } else {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(size.width / 2, size.height / 2);
                    ctx.arc(0, 0, 1, 0, Math.PI * 2);
                    ctx.restore();
                }
                if (fill.type !== 'none') {
                    this.applyFill(ctx, fill);
                    ctx.fill();
                }
                this.applyStroke(ctx, stroke);
                ctx.stroke();
                break;
        }
        ctx.restore();
    }

    private renderLinearToCanvas(ctx: ServerCanvasContext, element: LinearElement): void {
        const { points, style, arrowEnd, arrowStart } = element.data;
        if (points.length < 2) return;
        ctx.save();
        this.applyStroke(ctx, style);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();

        const headLen = Math.max(style.width * 4, 12);
        if (arrowEnd) {
            this.drawArrowheadCanvas(ctx, points[points.length - 2], points[points.length - 1], headLen);
        }
        if (arrowStart) {
            this.drawArrowheadCanvas(ctx, points[1], points[0], headLen);
        }
        ctx.restore();
    }

    private drawArrowheadCanvas(
        ctx: ServerCanvasContext,
        from: { x: number; y: number },
        to: { x: number; y: number },
        size: number,
    ): void {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
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
        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, position.y + i * lineHeight);
        ctx.restore();
    }

    private renderImageToCanvas(ctx: ServerCanvasContext, element: ImageElement): void {
        const { position, size } = element.data;
        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(position.x, position.y, size.width, size.height);
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.strokeRect(position.x, position.y, size.width, size.height);
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(position.x + size.width, position.y + size.height);
        ctx.moveTo(position.x + size.width, position.y);
        ctx.lineTo(position.x, position.y + size.height);
        ctx.stroke();
        ctx.restore();
    }

    // ── SVG rendering ────────────────────────────────────────────────────

    private renderElementToSvg(element: Element, offsetX: number, offsetY: number): string {
        switch (element.type) {
            case 'stroke':
                return this.renderStrokeToSvg(element, offsetX, offsetY);
            case 'shape':
                return this.renderShapeToSvg(element, offsetX, offsetY);
            case 'linear':
                return this.renderLinearToSvg(element, offsetX, offsetY);
            case 'text':
                return this.renderTextToSvg(element, offsetX, offsetY);
            case 'image':
                return this.renderImageToSvg(element, offsetX, offsetY);
            case 'group':
                return '';
            default:
                return '';
        }
    }

    private renderStrokeToSvg(element: StrokeElement, offsetX: number, offsetY: number): string {
        const { points, style } = element.data;
        if (points.length < 2) return '';
        const d = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x + offsetX},${p.y + offsetY}`)
            .join(' ');
        return (
            `    <path d="${d}" fill="none" ` +
            `stroke="${this.escapeAttr(style.color)}" ` +
            `stroke-width="${style.width}" ` +
            `stroke-opacity="${style.opacity}" ` +
            `stroke-linecap="${style.lineCap}" ` +
            `stroke-linejoin="${style.lineJoin}" />`
        );
    }

    private renderShapeToSvg(element: ShapeElement, offsetX: number, offsetY: number): string {
        const { shapeType, position, size, rotation, style } = element.data;
        const { stroke, fill } = style;
        const cx = position.x + offsetX + size.width / 2;
        const cy = position.y + offsetY + size.height / 2;
        const transform = rotation !== 0
            ? ` transform="rotate(${(rotation * 180) / Math.PI},${cx},${cy})"`
            : '';
        const fillAttr = fill.type === 'none'
            ? 'fill="none"'
            : `fill="${this.escapeAttr(fill.color)}" fill-opacity="${fill.opacity}"`;
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
                    `width="${size.width}" height="${size.height}" ${fillAttr} ${strokeAttr}${transform} />`
                );
            case 'diamond': {
                const x0 = position.x + offsetX, y0 = position.y + offsetY;
                const pts = [
                    `${x0 + size.width / 2},${y0}`,
                    `${x0 + size.width},${y0 + size.height / 2}`,
                    `${x0 + size.width / 2},${y0 + size.height}`,
                    `${x0},${y0 + size.height / 2}`,
                ].join(' ');
                return `    <polygon points="${pts}" ${fillAttr} ${strokeAttr}${transform} />`;
            }
            case 'ellipse':
                return (
                    `    <ellipse cx="${cx}" cy="${cy}" ` +
                    `rx="${size.width / 2}" ry="${size.height / 2}" ${fillAttr} ${strokeAttr}${transform} />`
                );
        }
    }

    private renderLinearToSvg(element: LinearElement, offsetX: number, offsetY: number): string {
        const { points, style, arrowEnd, arrowStart } = element.data;
        if (points.length < 2) return '';
        const strokeAttr =
            `stroke="${this.escapeAttr(style.color)}" ` +
            `stroke-width="${style.width}" ` +
            `stroke-opacity="${style.opacity}" ` +
            `stroke-linecap="${style.lineCap}" ` +
            `stroke-linejoin="${style.lineJoin}"`;
        const polyPoints = points.map((p) => `${p.x + offsetX},${p.y + offsetY}`).join(' ');
        const lines = [`    <polyline points="${polyPoints}" fill="none" ${strokeAttr} />`];
        const headLen = Math.max(style.width * 4, 12);
        if (arrowEnd) {
            lines.push(this.arrowheadSvg(points[points.length - 2], points[points.length - 1], headLen, offsetX, offsetY, strokeAttr));
        }
        if (arrowStart) {
            lines.push(this.arrowheadSvg(points[1], points[0], headLen, offsetX, offsetY, strokeAttr));
        }
        return lines.join('\n');
    }

    private arrowheadSvg(
        from: { x: number; y: number },
        to: { x: number; y: number },
        size: number,
        offsetX: number,
        offsetY: number,
        strokeAttr: string,
    ): string {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const tx = to.x + offsetX, ty = to.y + offsetY;
        const a1x = tx - size * Math.cos(angle - Math.PI / 6);
        const a1y = ty - size * Math.sin(angle - Math.PI / 6);
        const a2x = tx - size * Math.cos(angle + Math.PI / 6);
        const a2y = ty - size * Math.sin(angle + Math.PI / 6);
        return [
            `    <line x1="${tx}" y1="${ty}" x2="${a1x}" y2="${a1y}" ${strokeAttr} />`,
            `    <line x1="${tx}" y1="${ty}" x2="${a2x}" y2="${a2y}" ${strokeAttr} />`,
        ].join('\n');
    }

    private renderTextToSvg(element: TextElement, offsetX: number, offsetY: number): string {
        const { content, position, size, style } = element.data;
        const anchor =
            style.textAlign === 'center' ? 'middle'
                : style.textAlign === 'right' ? 'end'
                    : 'start';
        const x =
            style.textAlign === 'center' ? position.x + offsetX + size.width / 2
                : style.textAlign === 'right' ? position.x + offsetX + size.width
                    : position.x + offsetX;
        const lines = content.split('\n');
        const lineHeight = style.fontSize * 1.2;
        const fontStyleAttr = style.fontStyle === 'italic' ? ' font-style="italic"' : '';
        const tspans = lines
            .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`)
            .join('');
        return (
            `    <text x="${x}" y="${position.y + offsetY + style.fontSize}" ` +
            `fill="${this.escapeAttr(style.color)}" ` +
            `font-family="${this.escapeAttr(style.fontFamily)}" ` +
            `font-size="${style.fontSize}" ` +
            `font-weight="${style.fontWeight}"${fontStyleAttr} ` +
            `text-anchor="${anchor}">` + tspans + `</text>`
        );
    }

    private renderImageToSvg(element: ImageElement, offsetX: number, offsetY: number): string {
        const { position, size } = element.data;
        const x = position.x + offsetX, y = position.y + offsetY;
        return [
            `    <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1" />`,
            `    <line x1="${x}" y1="${y}" x2="${x + size.width}" y2="${y + size.height}" stroke="#9ca3af" stroke-width="1" />`,
            `    <line x1="${x + size.width}" y1="${y}" x2="${x}" y2="${y + size.height}" stroke="#9ca3af" stroke-width="1" />`,
        ].join('\n');
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private applyFill(
        ctx: ServerCanvasContext,
        fill: { type: string; color: string; opacity: number },
    ): void {
        ctx.globalAlpha = fill.opacity;
        ctx.fillStyle = fill.color;
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
