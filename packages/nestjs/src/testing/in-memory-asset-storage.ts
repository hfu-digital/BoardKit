import type { Asset } from '@hfu.digital/boardkit-core';
import {
    AssetStorage,
    type AssetMeta,
    type AssetRecord,
} from '../interfaces/asset-storage.interface';

let idCounter = 0;
function generateId(): string {
    return `asset-${++idCounter}-${Date.now()}`;
}

export class InMemoryAssetStorage extends AssetStorage {
    private assets = new Map<string, { asset: Asset; buffer: Buffer }>();

    async upload(
        boardId: string,
        file: Buffer,
        meta: AssetMeta,
    ): Promise<Asset> {
        const id = generateId();
        const storageKey = `${boardId}/${id}`;
        const asset: Asset = {
            id,
            boardId,
            mimeType: meta.mimeType,
            sizeBytes: meta.sizeBytes,
            storageKey,
            uploadedBy: meta.uploadedBy,
            createdAt: new Date().toISOString(),
        };
        this.assets.set(storageKey, { asset, buffer: file });
        return asset;
    }

    async getUrl(storageKey: string): Promise<string> {
        const entry = this.assets.get(storageKey);
        if (!entry) throw new Error(`Asset ${storageKey} not found`);
        const base64 = entry.buffer.toString('base64');
        return `data:${entry.asset.mimeType};base64,${base64}`;
    }

    async delete(storageKey: string): Promise<void> {
        this.assets.delete(storageKey);
    }

    async getBoardUsage(boardId: string): Promise<number> {
        let total = 0;
        for (const entry of this.assets.values()) {
            if (entry.asset.boardId === boardId) {
                total += entry.asset.sizeBytes;
            }
        }
        return total;
    }

    async download(storageKey: string): Promise<Buffer> {
        const entry = this.assets.get(storageKey);
        if (!entry) throw new Error(`Asset ${storageKey} not found`);
        return entry.buffer;
    }

    async findById(
        boardId: string,
        assetId: string,
    ): Promise<AssetRecord | null> {
        for (const entry of this.assets.values()) {
            if (entry.asset.boardId === boardId && entry.asset.id === assetId) {
                return {
                    storageKey: entry.asset.storageKey,
                    mimeType: entry.asset.mimeType,
                    sizeBytes: entry.asset.sizeBytes,
                };
            }
        }
        return null;
    }
}
