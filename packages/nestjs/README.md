# @hfu.digital/boardkit-nestjs

NestJS dynamic module for [BoardKit](../../README.md). Provides a real-time collaboration server with Socket.IO, pluggable storage adapters, and a permission model (viewer < editor < owner).

## Installation

```bash
bun add @hfu.digital/boardkit-nestjs
```

### Peer Dependencies

```bash
bun add @nestjs/common @nestjs/core @nestjs/websockets @nestjs/platform-socket.io rxjs
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { BoardModule } from '@hfu.digital/boardkit-nestjs';

@Module({
    imports: [
        BoardModule.register({
            storage: new MyBoardStorage(),
            assetStorage: new MyAssetStorage(),
            eventLogStorage: new MyEventLogStorage(),
            authGuard: new MyAuthGuard(),
        }),
    ],
})
export class AppModule {}
```

## Storage Adapters

Implement the abstract interfaces to connect to your database. BoardKit never imports `@prisma/client` directly — adapters use structural typing:

```typescript
import type { BoardStorage, AssetStorage, EventLogStorage } from '@hfu.digital/boardkit-nestjs';

class PrismaBoardStorage implements BoardStorage {
    async getBoard(id: string) { /* ... */ }
    async createBoard(data) { /* ... */ }
    // ...
}
```

## Auth Guard

Implement `BoardAuthGuard` to handle authentication:

```typescript
import type { BoardAuthGuard } from '@hfu.digital/boardkit-nestjs';

class MyAuthGuard implements BoardAuthGuard {
    async validateRequest(token: string) {
        // Validate Bearer token, return user info
        return { userId: '...', displayName: '...' };
    }

    async validateConnection(token: string) {
        // Validate WebSocket connection token
        return { userId: '...', displayName: '...' };
    }
}
```

## Permission Model

Three roles enforced across all controllers and the WebSocket gateway:

- **viewer**: Read-only access to boards
- **editor**: Can create, update, and delete elements
- **owner**: Full access including board deletion and settings

## Real-time Collaboration

Socket.IO gateway at namespace `/board`. Protocol:

1. Client emits `join` with `{ boardId, token, lastSequence? }`
2. Server emits `message` with `joined` + `sync:full` or `sync:delta`
3. Client emits `mutate` with `{ mutations, requestId }`
4. Server emits `message` with `mutation:ack` + broadcasts `mutation:broadcast`

### Session Types

- **ephemeral**: 5-minute idle timeout, no archival snapshot
- **persistent**: 15-minute idle timeout, snapshot on archive

## Testing

In-memory adapters are provided for unit testing without a database:

```typescript
import {
    InMemoryBoardStorage,
    InMemoryAssetStorage,
    InMemoryEventLogStorage,
    MockAuthGuard,
} from '@hfu.digital/boardkit-nestjs';
```

## License

[MIT](../../LICENSE)
