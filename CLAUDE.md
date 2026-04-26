# CLAUDE.md

> For project vision, cross-project architecture, and global code style rules, see the root [CLAUDE.md](../CLAUDE.md).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Versioning

All `@hfu.digital` Kit packages (CourseKit, RoomKit, LoopKit, BoardKit) use **CalVer** in the form `yyyy.mm.version` — e.g., `2026.04.1`, `2026.04.2`, `2026.05.1`.

- The first release of each calendar month bumps `version` to `1`.
- Within a month, increments go `1, 2, 3, ...`.
- Versions are **not semver-comparable**. Downstream consumers should pin **exact** versions and update intentionally — range operators (`^`, `~`) do not carry their usual semantics.
- Git tags must match the regex `^v[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]+$`. The publish workflow's `validate-tag` job rejects malformed tags before any build runs.

## Build Commands

```bash
# Install dependencies (bun only — never npm/yarn)
bun install

# Build all packages (respects dependency order via turbo)
bun run build

# Build individual packages (core must build first — others depend on its .d.ts output)
cd packages/core && bunx tsc -b
cd packages/nestjs && bunx tsc -b
cd packages/react && bun run build   # uses vite

# Typecheck without emitting
cd packages/core && bunx tsc --noEmit
cd packages/nestjs && bunx tsc -b    # needs core's dist/
cd packages/react && bunx tsc -b     # needs core's dist/

# Dev watch mode
bun run dev

# Clean all dist directories
bun run clean
```

**Important**: `@hfu.digital/boardkit-nestjs` and `@hfu.digital/boardkit-react` use TypeScript project references (`"references": [{ "path": "../core" }]`). Core must be built first so its declaration files exist in `dist/`. Use `tsc -b` (not `tsc --noEmit`) for these packages.

## Code Style

- **4-space indentation** everywhere
- TypeScript strict mode enabled
- `"moduleResolution": "bundler"` — use standard ESM imports, no `.js` extensions needed

## Architecture

BoardKit is a collaborative whiteboard library organized as a Turborepo monorepo with three packages:

### `@hfu.digital/boardkit-core` — Zero-dependency shared kernel
Pure TypeScript, no runtime dependencies. Contains:
- **Types**: `Element` discriminated union (stroke | shape | text | image | stickyNote | group | connector), `Board`, `Page`, `Participant`, WebSocket protocol messages (`ClientMessage`/`ServerMessage`)
- **Scene graph**: Immutable `SceneState` = `Map<string, Element>` + `elementOrder: string[]`. All mutations (`addElement`, `removeElement`, `updateElement`) return new state objects.
- **Tools**: Abstract `Tool` class with state machine (`idle → active → finishing → idle`). Each tool processes `InputEvent` and returns `ToolResult` containing mutations and preview elements. 8 tools registered via `ToolRegistry.createDefault()`. The `HAND` tool ID exists as a constant but viewport panning is implemented at the input-pipeline layer (space+drag), not as a registered Tool subclass.
- **Operations**: LWW (Last-Writer-Wins) merge for collaboration conflicts (`mergeElement` compares `updatedAt`, remote wins on tie). History with undo/redo stack. Clipboard serialization/deserialization.
- **Grid/Alignment**: `snapToGrid()`, `findAlignmentGuides()` for element snapping

### `@hfu.digital/boardkit-nestjs` — Backend NestJS DynamicModule
Registered via `BoardModule.register(options)` with dependency-injected storage adapters:
- **Abstract interfaces** (`BoardStorage`, `AssetStorage`, `EventLogStorage`, `BoardAuthGuard`): Consumers implement these. **Never imports `@prisma/client`** — Prisma adapters use structural typing only.
- **Permission model**: viewer < editor < owner. Enforced in all 5 controllers and the WebSocket gateway. Controllers extract Bearer tokens and call `BoardAuthGuard.validateRequest()`.
- **Realtime**: Socket.IO gateway at namespace `/board`. Protocol is typed in `@hfu.digital/boardkit-core` (`ClientMessage`/`ServerMessage`). `CollaborationService` manages sessions with state machine: `created → active → idle → archived`.
- **Session types**: `ephemeral` (5-min idle timeout, no archival snapshot) vs `persistent` (15-min idle timeout, snapshot on archive)
- **Testing utilities**: `InMemoryBoardStorage`, `InMemoryAssetStorage`, `MockAuthGuard` for unit tests without a database

### `@hfu.digital/boardkit-react` — React component library (Vite library mode)
- **BoardStore**: Mutable store living **outside React** (not useState/useReducer). Slice-based pub/sub (`subscribe('scene', callback)`). Hooks use `useSyncExternalStore` to bridge into React.
- **Dual-canvas renderer**: `Canvas2DRenderer` creates two stacked `<canvas>` elements — static layer (only re-renders on scene nonce change) and interactive layer (every rAF frame for previews, cursors, selections). The static layer uses two-pass rendering: non-connectors first, then connectors.
- **Input pipeline**: `InputPipeline` translates DOM PointerEvents → `InputEvent`, handles space+drag panning and wheel zoom. Feeds into `GestureRecognizer` which dispatches to the active `Tool`.
- **Context**: `BoardKitProvider` instantiates `BoardStore`, `Canvas2DRenderer`, and `ToolRegistry` via refs (stable across re-renders). All hooks access these via `useBoardKit()`.
- **Key hooks**: `useBoard` (board CRUD), `useCollaboration` (WebSocket connection with max 5 reconnect attempts), `useViewport`, `useTool`, `useHistory`, `useGrid`, `useFollowMode`, `useImageImport`, `useErrorRecovery`

### Data flow
```
PointerEvent → InputPipeline → GestureRecognizer → Tool.onPointerX()
  → ToolResult { mutations, preview }
  → BoardStore.updateScene() [applies mutations]
  → Canvas2DRenderer.renderStaticLayer() [nonce invalidation]
  → useCollaboration sends mutations via Socket.IO
  → Server applies LWW merge, broadcasts to other clients
```

### Collaboration protocol (Socket.IO)
1. Client sends `join` with `boardId` + `token` + optional `lastSequence`
2. Server responds with `joined` (full participant list) + either `sync:full` or `sync:delta`
3. Client sends `mutate` with `ElementMutation[]` + `requestId`
4. Server responds with `mutation:ack` + broadcasts `mutation:broadcast` to room
5. Cursor positions broadcast separately via `cursor` / `cursor:broadcast`

### Element types and their tools
| Element | Tool | TOOL_IDS constant |
|---------|------|-------------------|
| stroke | PenTool | `PEN` |
| shape | ShapeTool | `SHAPE` |
| text | TextTool | `TEXT` |
| stickyNote | StickyNoteTool | `STICKY_NOTE` |
| connector | ConnectorTool | `CONNECTOR` |
| image | (via useImageImport) | — |
| group | (placeholder) | — |
| — | SelectTool | `SELECT` |
| — | EraserTool | `ERASER` |
| — | LaserTool (preview-only) | `LASER` |
| — | (no Tool class — input pipeline pan) | `HAND` |
