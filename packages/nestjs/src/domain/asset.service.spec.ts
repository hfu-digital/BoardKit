import { describe, it, expect, beforeEach } from 'vitest';
import {
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AssetService } from './asset.service';
import { InMemoryAssetStorage } from '../testing/in-memory-asset-storage';

describe('AssetService.upload', () => {
    let storage: InMemoryAssetStorage;
    let service: AssetService;

    beforeEach(() => {
        storage = new InMemoryAssetStorage();
        service = new AssetService(storage, {
            maxAssetSizeMb: 5,
            maxBoardSizeMb: 50,
        });
    });

    it('accepts AVIF uploads', async () => {
        const buf = Buffer.from('fake-avif');
        const asset = await service.upload('board-1', buf, {
            mimeType: 'image/avif',
            sizeBytes: buf.byteLength,
            uploadedBy: 'user-1',
        });
        expect(asset.mimeType).toBe('image/avif');
    });

    it.each([
        'image/heic',
        'image/heif',
        'image/bmp',
        'image/tiff',
    ])('accepts %s uploads', async (mimeType) => {
        const buf = Buffer.from('fake');
        await expect(
            service.upload('board-1', buf, {
                mimeType,
                sizeBytes: buf.byteLength,
                uploadedBy: 'user-1',
            }),
        ).resolves.toBeDefined();
    });

    it('rejects unsupported MIME with UnsupportedMediaTypeException (415)', async () => {
        const buf = Buffer.from('payload');
        const promise = service.upload('board-1', buf, {
            mimeType: 'image/x-foo',
            sizeBytes: buf.byteLength,
            uploadedBy: 'user-1',
        });
        await expect(promise).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
        await expect(promise).rejects.toThrow(/Unsupported file type: image\/x-foo/);
    });

    it('rejects oversize uploads with PayloadTooLargeException (413)', async () => {
        const tooBig = 6 * 1024 * 1024; // 6MB > 5MB limit
        const promise = service.upload('board-1', Buffer.alloc(tooBig), {
            mimeType: 'image/png',
            sizeBytes: tooBig,
            uploadedBy: 'user-1',
        });
        await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('rejects when board total exceeds limit with PayloadTooLargeException (413)', async () => {
        // Pre-fill the board near the cap. maxBoardSizeMb=50, maxAssetSizeMb=5.
        // Two 5MB uploads put it at 10MB; the next 45MB push would total 55 > 50.
        const fiveMb = 5 * 1024 * 1024;
        for (let i = 0; i < 2; i++) {
            await service.upload('board-1', Buffer.alloc(fiveMb), {
                mimeType: 'image/png',
                sizeBytes: fiveMb,
                uploadedBy: 'user-1',
            });
        }
        // Raise the per-asset limit so the board-total check is what trips.
        const generous = new AssetService(storage, {
            maxAssetSizeMb: 100,
            maxBoardSizeMb: 50,
        });
        const fortyFiveMb = 45 * 1024 * 1024;
        const promise = generous.upload('board-1', Buffer.alloc(fortyFiveMb), {
            mimeType: 'image/png',
            sizeBytes: fortyFiveMb,
            uploadedBy: 'user-1',
        });
        await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeException);
    });
});
