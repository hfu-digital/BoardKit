import type { Asset } from '@hfu.digital/boardkit-core';
import {
    AssetStorage,
    type AssetMeta,
    type AssetRecord,
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

class GetObjectCommand {
    constructor(public readonly input: Record<string, unknown>) {}
}

interface S3AssetRecord {
    id: string;
    boardId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
}

export class S3AssetAdapter extends AssetStorage {
    private readonly bucket: string;
    private readonly prefix: string;
    private readonly cdnUrl?: string;
    private readonly client: S3Client;

    // Track assets in memory for getBoardUsage / findById.
    // In production, consumers can layer their own metadata table on top
    // (the HFU adapter does this via Prisma).
    private assets = new Map<string, S3AssetRecord>();
    private byId = new Map<string, S3AssetRecord>();

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

        const record: S3AssetRecord = {
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
        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            }),
        );
        // AWS SDK v3 returns a Body with various stream shapes depending on
        // runtime. transformToByteArray is the documented helper; fall back to
        // collecting from a Node Readable for older clients.
        const body = response?.Body;
        if (!body) {
            throw new Error(`Empty body for storageKey ${storageKey}`);
        }
        if (typeof body.transformToByteArray === 'function') {
            const bytes = await body.transformToByteArray();
            return Buffer.from(bytes);
        }
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
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
