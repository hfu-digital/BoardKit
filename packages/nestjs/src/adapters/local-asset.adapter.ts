import type { Asset } from '@hfu.digital/boardkit-core';
import {
    AssetStorage,
    type AssetMeta,
} from '../interfaces/asset-storage.interface';
import { writeFile, unlink, mkdir, stat } from 'fs/promises';
import { join } from 'path';

export interface LocalAssetAdapterConfig {
    basePath: string;
    baseUrl?: string;
}

export class LocalAssetAdapter extends AssetStorage {
    private readonly basePath: string;
    private readonly baseUrl: string;
    private assets = new Map<
        string,
        { boardId: string; sizeBytes: number }
    >();

    constructor(config: LocalAssetAdapterConfig) {
        super();
        this.basePath = config.basePath;
        this.baseUrl = config.baseUrl ?? `file://${config.basePath}`;
    }

    async upload(
        boardId: string,
        file: Buffer,
        meta: AssetMeta,
    ): Promise<Asset> {
        const id = crypto.randomUUID();
        const storageKey = `${boardId}/${id}`;
        const dir = join(this.basePath, boardId);
        const filePath = join(this.basePath, storageKey);

        await mkdir(dir, { recursive: true });
        await writeFile(filePath, file);

        this.assets.set(storageKey, {
            boardId,
            sizeBytes: meta.sizeBytes,
        });

        return {
            id,
            boardId,
            mimeType: meta.mimeType,
            sizeBytes: meta.sizeBytes,
            storageKey,
            uploadedBy: meta.uploadedBy,
            createdAt: new Date().toISOString(),
        };
    }

    async getUrl(storageKey: string): Promise<string> {
        return `${this.baseUrl}/${storageKey}`;
    }

    async delete(storageKey: string): Promise<void> {
        const filePath = join(this.basePath, storageKey);
        try {
            await unlink(filePath);
        } catch {
            // File may not exist
        }
        this.assets.delete(storageKey);
    }

    async getBoardUsage(boardId: string): Promise<number> {
        let total = 0;
        for (const entry of this.assets.values()) {
            if (entry.boardId === boardId) {
                total += entry.sizeBytes;
            }
        }
        return total;
    }
}
