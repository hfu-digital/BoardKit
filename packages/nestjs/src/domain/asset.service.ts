import { Injectable } from '@nestjs/common';
import type { Asset } from '@boardkit/core';
import { LIMITS } from '@boardkit/core';
import { AssetStorage, type AssetMeta } from '../interfaces/asset-storage.interface';

export interface AssetServiceLimits {
    maxAssetSizeMb: number;
    maxBoardSizeMb: number;
}

@Injectable()
export class AssetService {
    private limits: AssetServiceLimits;

    constructor(
        private readonly storage: AssetStorage,
        limits?: Partial<AssetServiceLimits>,
    ) {
        this.limits = {
            maxAssetSizeMb:
                limits?.maxAssetSizeMb ?? LIMITS.MAX_ASSET_SIZE_MB,
            maxBoardSizeMb:
                limits?.maxBoardSizeMb ?? LIMITS.MAX_BOARD_SIZE_MB,
        };
    }

    async upload(
        boardId: string,
        file: Buffer,
        meta: AssetMeta,
    ): Promise<Asset> {
        // Validate file size
        const sizeMb = meta.sizeBytes / (1024 * 1024);
        if (sizeMb > this.limits.maxAssetSizeMb) {
            throw new Error(
                `Asset size ${sizeMb.toFixed(2)}MB exceeds limit of ${this.limits.maxAssetSizeMb}MB`,
            );
        }

        // Validate board total usage
        const currentUsage = await this.storage.getBoardUsage(boardId);
        const totalMb =
            (currentUsage + meta.sizeBytes) / (1024 * 1024);
        if (totalMb > this.limits.maxBoardSizeMb) {
            throw new Error(
                `Board storage would exceed limit of ${this.limits.maxBoardSizeMb}MB`,
            );
        }

        // Validate mime type
        const allowedTypes = [
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'application/pdf',
        ];
        if (!allowedTypes.includes(meta.mimeType)) {
            throw new Error(
                `Unsupported file type: ${meta.mimeType}`,
            );
        }

        return this.storage.upload(boardId, file, meta);
    }

    async getUrl(storageKey: string): Promise<string> {
        return this.storage.getUrl(storageKey);
    }

    async delete(storageKey: string): Promise<void> {
        return this.storage.delete(storageKey);
    }

    async getBoardUsage(boardId: string): Promise<number> {
        return this.storage.getBoardUsage(boardId);
    }
}
