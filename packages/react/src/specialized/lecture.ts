import type { Element } from '@hfu.digital/boardkit-core';
import { image, line, shape, text } from './elements';

export interface PdfAsset { assetId: string; url: string }
export interface PdfImportOptions { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void }

export function createLecturePage(pageId: string, userId: string, x: number, y: number, title = 'Lecture notes'): Element[] {
    const frame = shape(pageId, userId, x, y, 794, 1123);
    frame.data.style.fill = { type: 'solid', color: '#ffffff', opacity: 1 };
    frame.data.style.stroke.color = '#d1d5db';
    frame.data.specialized = { kind: 'lecture-page' };
    const result: Element[] = [frame, text(pageId, userId, x + 48, y + 40, title, 700)];
    for (let offset = 116; offset < 1080; offset += 32) {
        const rule = line(pageId, userId, [{ x: x + 48, y: y + offset }, { x: x + 746, y: y + offset }]);
        rule.data.style.color = '#dbeafe'; rule.data.style.width = 1;
        result.push(rule);
    }
    return result;
}

/**
 * Rasterizes each PDF page and uploads it through the existing asset API.
 * Returned image URLs remain usable after reload and by collaborators/export.
 * The worker is bundled into the package; importing a PDF never needs a CDN.
 */
export async function importLecturePdf(
    file: File, pageId: string, userId: string, x: number, y: number,
    upload: (file: File) => Promise<PdfAsset>, options: PdfImportOptions = {},
): Promise<Element[]> {
    if (file.size > 50 * 1024 * 1024) throw new Error('PDF files must be smaller than 50 MB.');
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') throw new Error('Choose a PDF file.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('This file is not a PDF.');
    const [{ getDocument, GlobalWorkerOptions }, { default: workerSource }] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw'),
    ]);
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
    const cancel = () => { void task.destroy(); };
    options.signal?.addEventListener('abort', cancel, { once: true });
    const checkCancelled = () => { if (options.signal?.aborted) throw new Error('PDF import cancelled.'); };
    try {
        checkCancelled();
        const pdf = await task.promise;
        if (pdf.numPages > 50) throw new Error('Import PDFs with up to 50 pages. Split larger documents first.');
        const elements: Element[] = [];
        let top = y;
        for (let number = 1; number <= pdf.numPages; number++) {
            checkCancelled();
            const page = await pdf.getPage(number);
            const natural = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 1600 / Math.max(natural.width, natural.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not render the PDF page.');
            await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not encode PDF page.')), 'image/png'));
            checkCancelled();
            const asset = await upload(new File([blob], `${file.name.replace(/\.pdf$/i, '')}-page-${number}.png`, { type: 'image/png' }));
            const width = 794, height = width * natural.height / natural.width;
            const label = text(pageId, userId, x, top, `${file.name} · Page ${number}`, width);
            const imported = image(pageId, userId, x, top + 36, width, height, asset.url, asset.assetId);
            imported.data.specialized = { kind: 'pdf-page', sourceName: file.name, pageNumber: number };
            elements.push(label, imported);
            top += height + 100;
            page.cleanup(); canvas.width = 0; canvas.height = 0;
            options.onProgress?.(number, pdf.numPages);
        }
        return elements;
    } finally {
        options.signal?.removeEventListener('abort', cancel);
        await task.destroy();
        URL.revokeObjectURL(workerUrl);
    }
}
