import { Injectable } from '@nestjs/common';
import type { ServerMessage } from '@boardkit/core';

interface ClientEntry {
    socket: { emit: (event: string, data: any) => void };
    boardId: string;
}

@Injectable()
export class SyncRelay {
    private clients = new Map<string, ClientEntry>();

    registerClient(clientId: string, socket: any, boardId: string): void {
        this.clients.set(clientId, { socket, boardId });
    }

    unregisterClient(clientId: string): void {
        this.clients.delete(clientId);
    }

    broadcast(boardId: string, message: ServerMessage, excludeClientId?: string): void {
        for (const [clientId, entry] of this.clients) {
            if (entry.boardId === boardId && clientId !== excludeClientId) {
                entry.socket.emit('message', message);
            }
        }
    }

    sendTo(clientId: string, message: ServerMessage): void {
        const entry = this.clients.get(clientId);
        if (entry) {
            entry.socket.emit('message', message);
        }
    }
}
