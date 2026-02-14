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
import type { JoinMessage, MutateMessage, CursorMessage } from '@boardkit/core';
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
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);

        if (boardId && userId) {
            await this.collaboration.leaveSession(boardId, userId);
            this.presence.removeParticipant(boardId, userId);
            this.syncRelay.broadcast(boardId, {
                type: 'participant:left',
                userId,
            }, client.id);
        }

        this.clientBoardMap.delete(client.id);
        this.clientUserMap.delete(client.id);
        this.clientRoleMap.delete(client.id);
    }

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinMessage,
    ): Promise<void> {
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
        client.join(payload.boardId);

        this.syncRelay.registerClient(client.id, client, payload.boardId);

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

        // Handle sync
        if (result.syncType === 'delta' && result.missedMutations) {
            await this.reconnection.sendDelta(client, result.missedMutations, payload.lastSequence ?? 0, result.session.currentSequence);
        } else {
            await this.reconnection.sendFullSync(client, payload.boardId, result.session.currentSequence);
        }

        // Broadcast new participant
        this.syncRelay.broadcast(payload.boardId, {
            type: 'participant:joined',
            userId: user.userId,
            displayName: user.displayName,
            color: result.session.participants.get(user.userId)?.color ?? '#666',
        }, client.id);
    }

    @SubscribeMessage('mutate')
    async handleMutate(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: MutateMessage,
    ): Promise<void> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        if (!boardId || !userId) return;

        const role = this.clientRoleMap.get(client.id);
        if (!role || role === 'viewer') {
            client.emit('message', {
                type: 'error',
                code: 'FORBIDDEN',
                message: 'Insufficient permissions: editor role required',
            });
            return;
        }

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
    }

    @SubscribeMessage('cursor')
    async handleCursor(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CursorMessage,
    ): Promise<void> {
        const boardId = this.clientBoardMap.get(client.id);
        const userId = this.clientUserMap.get(client.id);
        if (!boardId || !userId) return;

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
        client.emit('message', {
            type: 'pong',
            timestamp: payload.timestamp,
            serverTime: Date.now(),
        });
    }
}
