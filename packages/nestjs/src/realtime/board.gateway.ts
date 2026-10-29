import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JoinMessage, MutateMessage, CursorMessage } from '@hfu.digital/boardkit-core';
import { CollaborationService } from '../domain/collaboration.service';
import { PermissionService } from '../domain/permission.service';
import { BoardAuthGuard } from '../interfaces/auth-guard.interface';
import { PresenceManager } from './presence.manager';
import { SyncRelay } from './sync-relay';
import { ReconnectionHandler } from './reconnection.handler';

@WebSocketGateway({ namespace: '/board' })
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private clientBoardMap = new Map<string, string>();
    private clientUserMap = new Map<string, string>();
    private rate = new Map<string, { start: number; count: number }>();
    private credentials = new Map<string, string>();
    private joining = new Set<string>();
    private clientRoleMap = new Map<string, string>();

    constructor(
        private readonly collaboration: CollaborationService,
        private readonly authGuard: BoardAuthGuard,
        private readonly permissionService: PermissionService,
        private readonly presence: PresenceManager,
        private readonly syncRelay: SyncRelay,
        private readonly reconnection: ReconnectionHandler,
    ) {}

    async handleConnection(client: Socket): Promise<void> {
        // Connection established, waiting for join message
    }

    async handleDisconnect(client: Socket): Promise<void> {
        // Release the socket even if asynchronous session cleanup fails.
        this.syncRelay.unregisterClient(client.id);
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);

        this.clientBoardMap.delete(client.id);
        this.clientUserMap.delete(client.id);
        this.clientRoleMap.delete(client.id);
        this.credentials.delete(client.id);
        this.rate.delete(client.id);
        if (boardId && userId) this.presence.removeParticipant(boardId, userId);
        if (boardId) await client.leave(boardId);

        if (boardId && userId && ![...this.clientBoardMap].some(([id, board]) => board === boardId && this.clientUserMap.get(id) === userId)) {
            await this.collaboration.leaveSession(boardId, userId);
            this.syncRelay.broadcast(boardId, {
                type: 'participant:left',
                userId,
            }, client.id);
        }

    }

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinMessage,
    ): Promise<void> {
        if (this.joining.has(client.id) || this.clientBoardMap.has(client.id) || !payload ||
            typeof payload.token !== 'string' || payload.token.length > 8192 ||
            typeof payload.boardId !== 'string' || payload.boardId.length > 200) {
            client.disconnect(); return;
        }
        this.joining.add(client.id);
        try {
        const user = await this.authGuard.validateConnection(payload.token);
        if (!user) {
            client.emit('message', { type: 'error', code: 'AUTH_FAILED', message: 'Authentication failed' });
            client.disconnect();
            return;
        }

        const hasAccess = await this.permissionService.checkAccess(payload.boardId, user.userId, 'viewer');
        if (!hasAccess) {
            client.emit('message', { type: 'error', code: 'FORBIDDEN', message: 'Insufficient permissions' });
            client.disconnect();
            return;
        }

        // Determine the user's effective role for this board
        let effectiveRole = 'viewer';
        const isEditor = await this.permissionService.checkAccess(payload.boardId, user.userId, 'editor');
        if (isEditor) {
            const isOwner = await this.permissionService.checkAccess(payload.boardId, user.userId, 'owner');
            effectiveRole = isOwner ? 'owner' : 'editor';
        }

        this.clientBoardMap.set(client.id, payload.boardId);
        this.clientUserMap.set(client.id, user.userId);
        this.clientRoleMap.set(client.id, effectiveRole);
        this.credentials.set(client.id, payload.token);
        await client.join(payload.boardId);

        this.syncRelay.registerClient(client.id, client, payload.boardId, () => this.authorize(client, 'viewer'));

        const result = await this.collaboration.joinSession(
            payload.boardId,
            user.userId,
            user.displayName,
            payload.lastSequence,
        );

        this.presence.addParticipant(payload.boardId, {
            userId: user.userId,
            displayName: user.displayName,
            color: result.session.participants.get(user.userId)?.color ?? '#666',
            joinedAt: new Date().toISOString(),
        });

        // Send join confirmation
        client.emit('message', {
            type: 'joined',
            userId: user.userId,
            boardId: payload.boardId,
            participants: Array.from(result.session.participants.values()).map((p) => ({
                userId: p.userId,
                displayName: p.displayName,
                color: p.color,
            })),
            currentSequence: result.session.currentSequence,
        });

        const authorizedClient = { emit: (_event: string, message: any) => this.syncRelay.sendTo(client.id, message) };
        // Handle sync
        if (result.syncType === 'delta' && result.missedMutations) {
            await this.reconnection.sendDelta(authorizedClient, result.missedMutations, payload.lastSequence ?? 0, result.session.currentSequence);
        } else {
            await this.reconnection.sendFullSync(authorizedClient, payload.boardId, result.session.currentSequence);
        }

        // Broadcast new participant
        this.syncRelay.broadcast(payload.boardId, {
            type: 'participant:joined',
            userId: user.userId,
            displayName: user.displayName,
            color: result.session.participants.get(user.userId)?.color ?? '#666',
        }, client.id);
        } catch {
            try { await this.handleDisconnect(client); } finally { client.disconnect(); }
        } finally { this.joining.delete(client.id); }
    }

    private async authorize(client: Socket, role: string): Promise<boolean> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        try {
            const user = await this.authGuard.validateConnection(this.credentials.get(client.id) ?? '');
            if (boardId && userId && user?.userId === userId && await this.permissionService.checkAccess(boardId, userId, role)) return true;
        } catch { /* fail closed */ }
        try { await this.handleDisconnect(client); } finally { client.disconnect(); }
        return false;
    }

    @SubscribeMessage('mutate')
    async handleMutate(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: MutateMessage,
    ): Promise<void> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        if (!boardId || !userId) return;

        if (!await this.authorize(client, 'editor')) return;
        const role = this.clientRoleMap.get(client.id);
        if (!role || role === 'viewer') {
            client.emit('message', {
                type: 'error',
                code: 'FORBIDDEN',
                message: 'Insufficient permissions: editor role required',
            });
            return;
        }

        if (!payload || typeof payload.requestId !== 'string' || payload.requestId.length > 200) return;
        const budget = this.rate.get(client.id);
        if (budget && Date.now() - budget.start < 1000 && budget.count >= 20) {
            client.emit('message', { type: 'rate-limited', retryAfterMs: 1000 }); return;
        }
        this.rate.set(client.id, budget && Date.now() - budget.start < 1000 ? { ...budget, count: budget.count + 1 } : { start: Date.now(), count: 1 });
        try {
        const sequence = await this.collaboration.applyMutations(
            boardId,
            userId,
            payload.mutations,
        );

        // ACK to sender
        client.emit('message', {
            type: 'mutation:ack',
            requestId: payload.requestId,
            sequence,
        });

        // Broadcast to others
        this.syncRelay.broadcast(boardId, {
            type: 'mutation:broadcast',
            userId,
            mutations: payload.mutations,
            sequence,
        }, client.id);
        } catch { client.emit('message', { type: 'error', code: 'INVALID_MUTATION', message: 'Mutation rejected' }); }
    }

    @SubscribeMessage('cursor')
    async handleCursor(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CursorMessage,
    ): Promise<void> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        if (!boardId || !userId) return;

        if (!await this.authorize(client, 'viewer')) return;
        if (!payload || !payload.position || !Number.isFinite(payload.position.x) || !Number.isFinite(payload.position.y) ||
            typeof payload.pageId !== 'string' || payload.pageId.length > 200) return;
        this.presence.updateCursor(boardId, userId, payload.position, payload.pageId);

        this.syncRelay.broadcast(boardId, {
            type: 'cursor:broadcast',
            userId,
            position: payload.position,
            pageId: payload.pageId,
        }, client.id);
    }

    @SubscribeMessage('ping')
    async handlePing(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { timestamp: number },
    ): Promise<void> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        if (boardId && userId) {
            if (!await this.authorize(client, 'viewer')) return;
            this.presence.touch(boardId, userId);
        }
        client.emit('message', {
            type: 'pong',
            timestamp: payload.timestamp,
            serverTime: Date.now(),
        });
    }
}
