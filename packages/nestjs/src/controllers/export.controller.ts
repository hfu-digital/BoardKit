import { Controller, Post, Param, Body, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ExportService } from '../domain/export.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';
import { ExportRequestDto } from '../dto/export-request.dto';

type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

@Controller('boards/:boardId/export')
export class ExportController {
    constructor(
        private readonly exportService: ExportService,
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
    async exportBoard(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Body() dto: ExportRequestDto,
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'viewer');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        const buffer = await this.exportService.exportBoard(
            boardId,
            dto.format,
            dto.pageIds,
        );
        return buffer;
    }
}
