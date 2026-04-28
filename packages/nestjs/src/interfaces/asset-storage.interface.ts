import type { Asset } from '@hfu.digital/boardkit-core';

export interface AssetMeta {
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
}

export interface AssetRecord {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
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
    abstract download(storageKey: string): Promise<Buffer>;
    abstract findById(
        boardId: string,
        assetId: string,
    ): Promise<AssetRecord | null>;
}
