import type { Asset } from '@hfu.digital/boardkit-core';
import {
    AssetStorage,
    type AssetMeta,
    type AssetRecord,
} from '../interfaces/asset-storage.interface';
import { readFile, writeFile, unlink, mkdir, stat } from 'fs/promises';
import { join } from 'path';

export interface LocalAssetAdapterConfig {
    basePath: string;
    baseUrl?: string;
}

interface LocalAssetRecord {
    id: string;
    boardId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
}

export class LocalAssetAdapter extends AssetStorage {
    private readonly basePath: string;
    private readonly baseUrl: string;
    // Keyed by storageKey (used for getBoardUsage / delete bookkeeping).
    private assets = new Map<string, LocalAssetRecord>();
    // Keyed by `${boardId}:${id}` for findById without scanning.
    private byId = new Map<string, LocalAssetRecord>();

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

        const record: LocalAssetRecord = {
            id,
            boardId,
            storageKey,
            mimeType: meta.mimeType,
            sizeBytes: meta.sizeBytes,
        };
        this.assets.set(storageKey, record);
        this.byId.set(`${boardId}:${id}`, record);

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
        const record = this.assets.get(storageKey);
        if (record) {
            this.byId.delete(`${record.boardId}:${record.id}`);
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

    async download(storageKey: string): Promise<Buffer> {
        const filePath = join(this.basePath, storageKey);
        return readFile(filePath);
    }

    async findById(
        boardId: string,
        assetId: string,
    ): Promise<AssetRecord | null> {
        const record = this.byId.get(`${boardId}:${assetId}`);
        if (!record) return null;
        return {
            storageKey: record.storageKey,
            mimeType: record.mimeType,
            sizeBytes: record.sizeBytes,
        };
    }
}
