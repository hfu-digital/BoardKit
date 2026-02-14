import { Controller, Post, Param, Body, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';
import { CreateShareLinkDto } from '../dto/share-link.dto';

type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

@Controller('boards/:boardId/share')
export class ShareController {
    constructor(
        private readonly permissionService: PermissionService,
        private readonly authGuard: BoardAuthGuard,
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
    async createShareLink(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Body() dto: CreateShareLinkDto,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'owner');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        return this.permissionService.createShareLink(
            boardId,
            dto.permission,
            dto.expiresAt,
        );
    }
}
