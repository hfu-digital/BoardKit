import { Injectable } from '@nestjs/common';
import type { ServerMessage } from '@hfu.digital/boardkit-core';

interface ClientEntry {
    socket: { emit: (event: string, data: any) => void };
    boardId: string;
    authorize?: () => Promise<boolean>;
}

@Injectable()
export class SyncRelay {
    private clients = new Map<string, ClientEntry>();

    private boardClients = new Map<string, Set<string>>();

    registerClient(clientId: string, socket: any, boardId: string, authorize?: () => Promise<boolean>): void {
        this.unregisterClient(clientId);
        this.clients.set(clientId, { socket, boardId, authorize });
        let members = this.boardClients.get(boardId);
        if (!members) this.boardClients.set(boardId, members = new Set());
        members.add(clientId);
    }

    unregisterClient(clientId: string): void {
        const entry = this.clients.get(clientId);
        if (!entry) return;
        const members = this.boardClients.get(entry.boardId);
        members?.delete(clientId);
        if (members?.size === 0) this.boardClients.delete(entry.boardId);
        this.clients.delete(clientId);
    }

    broadcast(boardId: string, message: ServerMessage, excludeClientId?: string): void {
        const members = this.boardClients.get(boardId);
        if (!members) return;
        for (const clientId of members) {
            if (clientId !== excludeClientId) {
                this.sendTo(clientId, message);
            }
        }
    }

    sendTo(clientId: string, message: ServerMessage): void {
        const entry = this.clients.get(clientId);
        if (entry) {
            if (!entry.authorize) entry.socket.emit('message', message);
            else void entry.authorize().then(allowed => {
                if (allowed && this.clients.get(clientId) === entry) entry.socket.emit('message', message);
            }).catch(() => this.unregisterClient(clientId));
        }
    }
}
