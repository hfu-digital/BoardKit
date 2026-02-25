# @hfu.digital/boardkit-react

React component library for [BoardKit](../../README.md). Provides a dual-canvas renderer, input pipeline, gesture recognition, and hooks for real-time collaboration.

## Installation

```bash
bun add @hfu.digital/boardkit-react socket.io-client
```

### Peer Dependencies

```bash
bun add react react-dom socket.io-client
```

## Quick Start

```tsx
import { BoardKitProvider, WhiteboardCanvas } from '@hfu.digital/boardkit-react';

function App() {
    return (
        <BoardKitProvider
            config={{
                apiUrl: 'http://localhost:3000/api',
                wsUrl: 'http://localhost:3000',
                authToken: 'your-jwt-token',
            }}
        >
            <WhiteboardCanvas boardId="my-board" />
        </BoardKitProvider>
    );
}
```

## Architecture

### BoardKitProvider

Wraps your app and provides context for all hooks. Creates stable instances of:

- **BoardStore** — Mutable store outside React with slice-based pub/sub
- **Canvas2DRenderer** — Dual-canvas rendering engine
- **ToolRegistry** — Registered drawing tools

### Dual-Canvas Renderer

Two stacked `<canvas>` elements for optimal performance:

- **Static layer**: Re-renders only when the scene nonce changes (element create/update/delete)
- **Interactive layer**: Re-renders every frame via `requestAnimationFrame` (previews, cursors, selections)

### Input Pipeline

Translates DOM PointerEvents into BoardKit `InputEvent` objects:

```
PointerEvent → InputPipeline → GestureRecognizer → Tool.onPointerX()
  → ToolResult { mutations, preview }
```

Handles space+drag panning and wheel zoom automatically.

## Hooks

### `useCollaboration(boardId)`

Connects to the BoardKit Socket.IO server with automatic reconnection (max 5 attempts, exponential backoff):

```typescript
const { connectionState, sendMutations, sendCursor, disconnect } = useCollaboration('board-1');
```

### `useBoard`

Board CRUD operations via REST API.

### `useViewport`

Pan, zoom, and viewport state management.

### `useTool`

Active tool selection and configuration.

### `useHistory`

Undo/redo integration.

### `useGrid`

Grid visibility and snapping configuration.

### `useFollowMode`

Follow another participant's viewport.

### `useImageImport`

Import images onto the canvas.

### `useErrorRecovery`

Handle and recover from connection/sync errors.

## Store

`BoardStore` lives **outside React** for performance. Hooks use `useSyncExternalStore` to bridge into React's rendering cycle:

```typescript
import { useBoardKit } from '@hfu.digital/boardkit-react';

function MyComponent() {
    const { store } = useBoardKit();
    // Subscribe to specific slices for granular re-renders
    store.subscribe('scene', (scene) => { /* ... */ });
}
```

## License

[MIT](../../LICENSE)
