import { Controller, Get, Post, Delete, Body, Param, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { BoardService } from '../domain/board.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';
import { CreatePageDto } from '../dto/create-page.dto';

type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

@Controller('boards/:boardId/pages')
export class PageController {
    constructor(
        private readonly boardService: BoardService,
        private readonly authGuard: BoardAuthGuard,
        private readonly permissionService: PermissionService,
    ) {}

    private async getUser(req: RequestWithHeaders): Promise<AuthenticatedUser> {
        const authHeader = req.headers['authorization'];
        const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        if (!headerValue || !headerValue.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication required');
        }
        const token = headerValue.slice(7);
        const user = await this.authGuard.validateRequest(token);
        if (!user) {
            throw new UnauthorizedException('Authentication required');
        }
        return user;
    }

    @Post()
    async addPage(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Body() dto: CreatePageDto,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'editor');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return this.boardService.addPage(
            boardId,
            dto.order !== undefined
                ? { name: dto.name, order: dto.order }
                : undefined,
            user.userId,
        );
    }

    @Get()
    async getPages(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'viewer');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return this.boardService.getPages(boardId);
    }

    @Get(':pageId/elements')
    async getElements(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Param('pageId') pageId: string,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'viewer');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return this.boardService.getPageElements(pageId);
    }

    @Delete(':pageId')
    async deletePage(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Param('pageId') pageId: string,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'editor');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        await this.boardService.deletePage(pageId, boardId, user.userId);
        return { success: true };
    }
}
