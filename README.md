# BoardKit

A collaborative whiteboard SDK for building real-time canvas applications. BoardKit provides everything you need — from the scene graph and drawing tools to server-side collaboration and a React component library.

## Packages

| Package | Description |
|---------|-------------|
| [`@hfu.digital/boardkit-core`](./packages/core) | Zero-dependency shared kernel: types, scene graph, tools, collaboration protocol |
| [`@hfu.digital/boardkit-nestjs`](./packages/nestjs) | NestJS module with Socket.IO gateway, pluggable storage adapters, and permission model |
| [`@hfu.digital/boardkit-react`](./packages/react) | React components and hooks: dual-canvas renderer, input pipeline, real-time collaboration UI |

## Quick Start

```bash
# Install into your NestJS backend
bun add @hfu.digital/boardkit-nestjs

# Install into your React frontend
bun add @hfu.digital/boardkit-react socket.io-client
```

### Server (NestJS)

```typescript
import { Module } from '@nestjs/common';
import { BoardModule } from '@hfu.digital/boardkit-nestjs';
import { MyBoardStorage } from './my-board-storage';
import { MyAssetStorage } from './my-asset-storage';
import { MyEventLogStorage } from './my-event-log-storage';
import { MyAuthGuard } from './my-auth-guard';

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

### Client (React)

```tsx
import { BoardKitProvider, BoardCanvas, useCollaboration } from '@hfu.digital/boardkit-react';

function App() {
    return (
        <BoardKitProvider config={{ apiUrl: '/api', wsUrl: 'http://localhost:3000' }}>
            <Board />
        </BoardKitProvider>
    );
}

function Board() {
    useCollaboration('my-board');
    return <BoardCanvas />;
}
```

## Architecture

```
PointerEvent → InputPipeline → GestureRecognizer → Tool.onPointerX()
  → ToolResult { mutations, preview }
  → BoardStore.updateScene()
  → Canvas2DRenderer.renderStaticLayer()
  → useCollaboration sends mutations via Socket.IO
  → Server applies LWW merge, broadcasts to other clients
```

### Element Types

| Element | Tool | Description |
|---------|------|-------------|
| stroke | PenTool | Freehand drawing with pressure support |
| shape | ShapeTool | Rectangle, ellipse, line, arrow, triangle |
| text | TextTool | Rich text blocks |
| stickyNote | StickyNoteTool | Colored sticky notes |
| connector | ConnectorTool | Lines connecting elements with anchors |
| image | useImageImport | Imported images |
| group | — | Element grouping (placeholder) |

### Collaboration Protocol (Socket.IO)

1. Client sends `join` with `boardId` + `token` + optional `lastSequence`
2. Server responds with `joined` + `sync:full` or `sync:delta`
3. Client sends `mutate` with `ElementMutation[]` + `requestId`
4. Server responds with `mutation:ack` + broadcasts `mutation:broadcast`
5. Cursor positions sync via `cursor` / `cursor:broadcast`

## Development

```bash
# Install dependencies (bun only)
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint
bun run lint

# Dev watch mode
bun run dev

# Clean
bun run clean
```

### Build Order

Core must build first (other packages reference its declarations):

```bash
cd packages/core && bunx tsc -b
cd packages/nestjs && bunx tsc -b
cd packages/react && bun run build
```

Or use Turborepo which handles this automatically: `bun run build`

## License

[MIT](./LICENSE)
