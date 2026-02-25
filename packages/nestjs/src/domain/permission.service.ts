import { Injectable } from '@nestjs/common';
import type { ShareLink } from '@hfu.digital/boardkit-core';
import { BoardStorage } from '../interfaces/board-storage.interface';

const ROLE_HIERARCHY: Record<string, number> = {
    viewer: 0,
    editor: 1,
    owner: 2,
};

@Injectable()
export class PermissionService {
    constructor(private readonly storage: BoardStorage) {}

    async checkAccess(
        boardId: string,
        userId: string,
        requiredRole: string,
    ): Promise<boolean> {
        // Check if user is the owner
        const board = await this.storage.getBoard(boardId);
        if (board && board.ownerId === userId) return true;

        const memberRole = await this.storage.getMemberRole(
            boardId,
            userId,
        );
        if (!memberRole) return false;

        const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
        const actualLevel = ROLE_HIERARCHY[memberRole] ?? 0;
        return actualLevel >= requiredLevel;
    }

    async addMember(
        boardId: string,
        userId: string,
        role: string,
    ): Promise<void> {
        await this.storage.setMember(boardId, userId, role);
    }

    async removeMember(
        boardId: string,
        userId: string,
    ): Promise<void> {
        await this.storage.removeMember(boardId, userId);
    }

    async resolveShareLink(
        token: string,
    ): Promise<{ boardId: string; permission: string } | null> {
        const link = await this.storage.resolveShareLink(token);
        if (!link) return null;
        return { boardId: link.boardId, permission: link.permission };
    }

    async createShareLink(
        boardId: string,
        permission: string,
        expiresAt?: string,
    ): Promise<ShareLink> {
        return this.storage.createShareLink({
            boardId,
            permission: permission as 'view' | 'edit',
            expiresAt,
        });
    }
}
