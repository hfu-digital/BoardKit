import type {
    Board,
    Page,
    Element,
    BoardMember,
    ShareLink,
} from '@boardkit/core';
import {
    BoardStorage,
    type CreateBoardInput,
    type CreatePageInput,
    type BoardFilters,
    type ElementUpsert,
} from '../interfaces/board-storage.interface';

// Structural typing — NEVER import from @prisma/client
type PrismaDelegate = {
    create: (args: { data: any }) => Promise<any>;
    findUnique: (args: { where: any; include?: any }) => Promise<any>;
    findMany: (args: {
        where?: any;
        include?: any;
        orderBy?: any;
    }) => Promise<any[]>;
    update: (args: { where: any; data: any }) => Promise<any>;
    delete: (args: { where: any }) => Promise<any>;
};

type PrismaElementDelegate = PrismaDelegate & {
    createMany: (args: { data: any[] }) => Promise<any>;
    deleteMany: (args: { where: any }) => Promise<any>;
    upsert: (args: { where: any; create: any; update: any }) => Promise<any>;
};

type PrismaShareLinkDelegate = PrismaDelegate & {
    findFirst: (args: { where: any }) => Promise<any>;
};

type PrismaBoardMemberDelegate = PrismaDelegate & {
    findFirst: (args: { where: any }) => Promise<any>;
    deleteMany: (args: { where: any }) => Promise<any>;
};

export interface PrismaBoardAdapterConfig {
    board: PrismaDelegate;
    page: PrismaDelegate;
    element: PrismaElementDelegate;
    boardMember: PrismaBoardMemberDelegate;
    shareLink: PrismaShareLinkDelegate;
}

export class PrismaBoardAdapter extends BoardStorage {
    constructor(private readonly prisma: PrismaBoardAdapterConfig) {
        super();
    }

    async createBoard(data: CreateBoardInput): Promise<Board> {
        return this.prisma.board.create({
            data: {
                name: data.name,
                ownerId: data.ownerId,
                sessionType: data.sessionType ?? 'persistent',
            },
        });
    }

    async getBoard(id: string): Promise<Board | null> {
        return this.prisma.board.findUnique({ where: { id } });
    }

    async listBoards(filters: BoardFilters): Promise<Board[]> {
        const where: Record<string, unknown> = {};
        if (filters.ownerId !== undefined) where.ownerId = filters.ownerId;
        if (filters.isArchived !== undefined)
            where.isArchived = filters.isArchived;
        if (filters.sessionType !== undefined)
            where.sessionType = filters.sessionType;
        return this.prisma.board.findMany({ where });
    }

    async updateBoard(id: string, data: Partial<Board>): Promise<Board> {
        const { id: _id, ...updateData } = data;
        return this.prisma.board.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteBoard(id: string): Promise<void> {
        await this.prisma.board.delete({ where: { id } });
    }

    async createPage(boardId: string, data: CreatePageInput): Promise<Page> {
        return this.prisma.page.create({
            data: {
                boardId,
                name: data.name ?? 'Untitled Page',
                order: data.order,
            },
        });
    }

    async getPages(boardId: string): Promise<Page[]> {
        return this.prisma.page.findMany({
            where: { boardId },
            orderBy: { order: 'asc' },
        });
    }

    async getPage(id: string): Promise<Page | null> {
        return this.prisma.page.findUnique({ where: { id } });
    }

    async reorderPages(boardId: string, pageIds: string[]): Promise<void> {
        for (let i = 0; i < pageIds.length; i++) {
            await this.prisma.page.update({
                where: { id: pageIds[i] },
                data: { order: i },
            });
        }
    }

    async deletePage(id: string): Promise<void> {
        await this.prisma.page.delete({ where: { id } });
    }

    async upsertElements(
        pageId: string,
        elements: ElementUpsert[],
    ): Promise<void> {
        for (const el of elements) {
            await this.prisma.element.upsert({
                where: { id: el.id },
                create: {
                    id: el.id,
                    pageId: el.pageId,
                    type: el.type,
                    data: el.data,
                    zIndex: el.zIndex,
                    createdBy: el.createdBy,
                },
                update: {
                    data: el.data,
                    zIndex: el.zIndex,
                },
            });
        }
    }

    async getElements(pageId: string): Promise<Element[]> {
        return this.prisma.element.findMany({
            where: { pageId },
            orderBy: { zIndex: 'asc' },
        });
    }

    async deleteElements(ids: string[]): Promise<void> {
        await this.prisma.element.deleteMany({
            where: { id: { in: ids } },
        });
    }

    async setMember(
        boardId: string,
        userId: string,
        role: string,
    ): Promise<void> {
        const existing = await this.prisma.boardMember.findFirst({
            where: { boardId, userId },
        });
        if (existing) {
            await this.prisma.boardMember.update({
                where: { id: existing.id },
                data: { role },
            });
        } else {
            await this.prisma.boardMember.create({
                data: { boardId, userId, role },
            });
        }
    }

    async getMembers(boardId: string): Promise<BoardMember[]> {
        return this.prisma.boardMember.findMany({
            where: { boardId },
        });
    }

    async getMemberRole(
        boardId: string,
        userId: string,
    ): Promise<string | null> {
        const member = await this.prisma.boardMember.findFirst({
            where: { boardId, userId },
        });
        return member?.role ?? null;
    }

    async removeMember(boardId: string, userId: string): Promise<void> {
        await this.prisma.boardMember.deleteMany({
            where: { boardId, userId },
        });
    }

    async createShareLink(data: {
        boardId: string;
        permission: 'view' | 'edit';
        expiresAt?: string;
    }): Promise<ShareLink> {
        return this.prisma.shareLink.create({
            data: {
                boardId: data.boardId,
                token: crypto.randomUUID(),
                permission: data.permission,
                expiresAt: data.expiresAt,
            },
        });
    }

    async resolveShareLink(token: string): Promise<ShareLink | null> {
        const link = await this.prisma.shareLink.findFirst({
            where: { token },
        });
        if (!link) return null;
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
            return null;
        }
        return link;
    }

    async deleteShareLink(id: string): Promise<void> {
        await this.prisma.shareLink.delete({ where: { id } });
    }
}
