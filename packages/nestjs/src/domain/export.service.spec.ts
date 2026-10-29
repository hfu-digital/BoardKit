import { describe, expect, it } from 'vitest';
import type { ImageElement } from '@hfu.digital/boardkit-core';
import { ExportService } from './export.service';
import { InMemoryBoardStorage } from '../testing/in-memory-board-storage';

async function exportImage(url: string) {
    const storage = new InMemoryBoardStorage();
    const board = await storage.createBoard({ name: 'Math', ownerId: 'user' });
    const page = await storage.createPage(board.id, { name: 'Page 1', order: 0 });
    const element: ImageElement = {
        id: 'equation', pageId: page.id, type: 'image', zIndex: 0,
        createdBy: 'user', createdAt: '', updatedAt: '',
        data: { assetId: '', url, position: { x: 0, y: 0 },
            size: { width: 120, height: 40 }, rotation: 0,
            bounds: { x: 0, y: 0, width: 120, height: 40 } },
    };
    await storage.upsertElements(page.id, [{ id: element.id, pageId: page.id, createdBy: 'user', type: element.type, data: element.data, zIndex: 0 }]);
    return (await new ExportService(storage).exportBoard(board.id, 'svg')).toString();
}

describe('inline equation SVG export', () => {
    it('embeds self-contained equation images without asset storage', async () => {
        const url = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Cpath/%3E%3C/svg%3E';
        expect(await exportImage(url)).toContain(`href="${url}"`);
    });
    it('escapes image attributes and never embeds arbitrary URL schemes', async () => {
        const output = await exportImage('data:image/png;base64,abc" onload="x');
        expect(output).toContain('abc&quot; onload=&quot;x');
        expect(output).not.toContain('" onload="x');
        expect(await exportImage('javascript:alert(1)')).not.toContain('javascript:');
        expect(await exportImage('https://example.com/private.png')).not.toContain('href=');
    });
});
