import type { Asset } from '@boardkit/core';

export interface AssetMeta {
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
}

export abstract class AssetStorage {
    abstract upload(
        boardId: string,
        file: Buffer,
        meta: AssetMeta,
    ): Promise<Asset>;
    abstract getUrl(storageKey: string): Promise<string>;
    abstract delete(storageKey: string): Promise<void>;
    abstract getBoardUsage(boardId: string): Promise<number>;
}
