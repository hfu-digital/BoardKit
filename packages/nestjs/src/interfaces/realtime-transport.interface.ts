import type { ClientMessage, ServerMessage } from '@boardkit/core';

export interface TransportConnection {
    id: string;
    userId: string;
    send(message: ServerMessage): void;
    close(): void;
}

export abstract class RealtimeTransport {
    abstract onConnection(
        handler: (conn: TransportConnection, message: ClientMessage) => void,
    ): void;
    abstract onDisconnection(
        handler: (conn: TransportConnection) => void,
    ): void;
    abstract broadcast(
        boardId: string,
        message: ServerMessage,
        excludeConnectionId?: string,
    ): void;
}
