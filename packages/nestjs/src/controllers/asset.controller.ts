import { Controller, Post, Param, Body, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AssetService } from '../domain/asset.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';

type RequestWithHeaders = { headers: Record<string, string | string[] | undefined> };

@Controller('boards/:boardId/assets')
export class AssetController {
    constructor(
        private readonly assetService: AssetService,
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
    async uploadAsset(
        @Req() req: RequestWithHeaders,
        @Param('boardId') boardId: string,
        @Body() body: { file: string; mimeType: string; sizeBytes: number },
    ) {
        const user = await this.getUser(req);
        const hasAccess = await this.permissionService.checkAccess(boardId, user.userId, 'editor');
        if (!hasAccess) {
            throw new ForbiddenException('Insufficient permissions');
        }
        const buffer = Buffer.from(body.file, 'base64');
        return this.assetService.upload(boardId, buffer, {
            mimeType: body.mimeType,
            sizeBytes: body.sizeBytes,
            uploadedBy: user.userId,
        });
    }
}
