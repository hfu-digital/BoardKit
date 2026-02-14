import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { BoardService } from '../domain/board.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';
import { CreateBoardDto } from '../dto/create-board.dto';
import { UpdateBoardDto } from '../dto/update-board.dto';

type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

@Controller('boards')
export class BoardController {
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
    async createBoard(
        @Req() req: RequestWithHeaders,
        @Body() dto: CreateBoardDto,
    ) {
        const user = await this.getUser(req);
        return this.boardService.createBoard({
            name: dto.name,
            ownerId: user.userId,
            sessionType: dto.sessionType,
        });
    }

    @Get()
    async listBoards(@Req() req: RequestWithHeaders) {
        const user = await this.getUser(req);
        return this.boardService.listBoards(user.userId);
    }

    @Get(':id')
    async getBoard(
        @Req() req: RequestWithHeaders,
        @Param('id') id: string,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(id, user.userId, 'viewer');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        const board = await this.boardService.getBoard(id);
        const pages = await this.boardService.getPages(id);
        return { ...board, pages };
    }

    @Patch(':id')
    async updateBoard(
        @Req() req: RequestWithHeaders,
        @Param('id') id: string,
        @Body() dto: UpdateBoardDto,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(id, user.userId, 'editor');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return this.boardService.updateBoard(id, dto, user.userId);
    }

    @Delete(':id')
    async archiveBoard(
        @Req() req: RequestWithHeaders,
        @Param('id') id: string,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(id, user.userId, 'owner');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        await this.boardService.archiveBoard(id, user.userId);
        return { success: true };
    }
}
