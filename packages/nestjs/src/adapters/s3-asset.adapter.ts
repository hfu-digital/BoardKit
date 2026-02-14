import type { Asset } from '@boardkit/core';
import {
    AssetStorage,
    type AssetMeta,
} from '../interfaces/asset-storage.interface';

// Structural typing — accepts any S3-compatible client
interface S3Client {
    send(command: any): Promise<any>;
}

export interface S3AssetAdapterConfig {
    client: S3Client;
    bucket: string;
    prefix?: string;
    cdnUrl?: string;
}

// Minimal command shapes for structural typing
class PutObjectCommand {
    constructor(public readonly input: Record<string, unknown>) {}
}

class DeleteObjectCommand {
    constructor(public readonly input: Record<string, unknown>) {}
}

export class S3AssetAdapter extends AssetStorage {
    private readonly bucket: string;
    private readonly prefix: string;
    private readonly cdnUrl?: string;
    private readonly client: S3Client;

    // Track assets in memory for getBoardUsage
    // In production, query the database instead
    private assets = new Map<
        string,
        { boardId: string; sizeBytes: number }
    >();

    constructor(config: S3AssetAdapterConfig) {
        super();
        this.client = config.client;
        this.bucket = config.bucket;
        this.prefix = config.prefix ?? '';
        this.cdnUrl = config.cdnUrl;
    }

    async upload(
        boardId: string,
        file: Buffer,
        meta: AssetMeta,
    ): Promise<Asset> {
        const id = crypto.randomUUID();
        const storageKey = `${this.prefix}${boardId}/${id}`;

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
                Body: file,
                ContentType: meta.mimeType,
            }),
        );

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
        if (this.cdnUrl) {
            return `${this.cdnUrl}/${storageKey}`;
        }
        return `https://${this.bucket}.s3.amazonaws.com/${storageKey}`;
    }

    async delete(storageKey: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            }),
        );
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
