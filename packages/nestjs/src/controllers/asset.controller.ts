import {
    Controller,
    Post,
    Get,
    Param,
    Query,
    Body,
    Req,
    Res,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { AssetService } from '../domain/asset.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard, type AuthenticatedUser } from '../interfaces/auth-guard.interface';

type RequestWithHeaders = {
    headers: Record<string, string | string[] | undefined>;
};

// Structural type so we don't pull a Fastify type dep into BoardKit core.
// Matches both Fastify's `FastifyReply` and Express's `Response` shape we use.
type ReplyLike = {
    header(name: string, value: string | number): ReplyLike;
    send(payload: unknown): ReplyLike;
};

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
        const asset = await this.assetService.upload(boardId, buffer, {
            mimeType: body.mimeType,
            sizeBytes: body.sizeBytes,
            uploadedBy: user.userId,
        });
        // Return a relative URL so consumers can absolutise it against their
        // own API base. Storing the absolute URL in element data keeps
        // collaborators consistent across devices/browsers.
        return { ...asset, url: `/boards/${boardId}/assets/${asset.id}` };
    }

    @Get(':assetId')
    async getAsset(
        @Req() req: RequestWithHeaders,
        @Res() reply: ReplyLike,
        @Param('boardId') boardId: string,
        @Param('assetId') assetId: string,
        @Query('shareToken') shareTokenQuery?: string,
    ): Promise<void> {
        // Auth: try Bearer (member with viewer access), then fall back to a
        // share-link token (anonymous viewers via a public board link).
        const authHeader = req.headers['authorization'];
        const bearerHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        let authorized = false;

        if (bearerHeader && bearerHeader.startsWith('Bearer ')) {
            const user = await this.authGuard.validateRequest(bearerHeader.slice(7));
            if (user) {
                authorized = await this.permissionService.checkAccess(
                    boardId,
                    user.userId,
                    'viewer',
                );
            }
        }

        if (!authorized) {
            const shareHeaderRaw = req.headers['x-share-token'];
            const shareHeader = Array.isArray(shareHeaderRaw)
                ? shareHeaderRaw[0]
                : shareHeaderRaw;
            const shareToken = shareTokenQuery ?? shareHeader;
            if (shareToken) {
                const resolved = await this.permissionService.resolveShareLink(shareToken);
                if (resolved && resolved.boardId === boardId) {
                    authorized = true;
                }
            }
        }

        if (!authorized) {
            throw new ForbiddenException('Insufficient permissions');
        }

        const record = await this.assetService.findById(boardId, assetId);
        if (!record) {
            throw new NotFoundException('Asset not found');
        }

        const buffer = await this.assetService.download(record.storageKey);

        reply
            .header('Content-Type', record.mimeType)
            .header('Content-Length', record.sizeBytes)
            // Asset ids are immutable uuids — safe to cache aggressively. The
            // private directive prevents shared caches (CDNs, proxies) from
            // serving the bytes to other users without re-checking auth.
            .header('Cache-Control', 'private, max-age=31536000, immutable')
            .send(buffer);
    }
}
