# CLAUDE.md

> For project vision, cross-project architecture, and global code style rules, see the root [CLAUDE.md](../CLAUDE.md).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Versioning

All `@hfu.digital` Kit packages (CourseKit, RoomKit, LoopKit, BoardKit) use **CalVer** in the form `yyyy.mm.version` — e.g., `2026.04.1`, `2026.04.2`, `2026.05.1`. The three BoardKit packages are currently at **`2026.04.25`** and are versioned in lockstep.

- The month component is **zero-padded** (`04`, not `4`). The first release of each calendar month bumps `version` to `1`, then increments `1, 2, 3, ...`.
- Versions are **not semver-comparable**. Downstream consumers should pin **exact** versions and update intentionally — range operators (`^`, `~`) do not carry their usual semantics. Note npm strips the leading zero, so `2026.04.25` appears on the registry as `2026.4.25`.
- Git tags must match the regex `^v[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]+$`. The publish workflow's `validate-tag` job rejects malformed tags before any build runs.

## Build Commands

All commands run from the repo root unless noted. **Bun only — never npm/yarn.** Turbo orchestrates the three workspace packages (`packages/*`); `examples/*` are also workspaces.

```bash
bun install        # Install workspace dependencies
bun run build      # turbo build  — builds core first (dependsOn ["^build"])
bun run dev        # turbo dev    — watch mode (persistent, uncached)
bun run lint       # turbo lint   — ESLint across packages
bun run test       # turbo test   — Vitest; dependsOn ["build"]
bun run clean      # turbo clean  — removes each package's dist/
```

Per-package scripts (run inside `packages/<pkg>/`): `build`, `dev`, `clean`, `lint`, `test`, `test:watch`.
- **core** & **nestjs** build with `tsc`; **react** builds with `vite build` (library mode, `vite-plugin-dts` emits types).
- All three test with `vitest run` (`vitest` for watch).

**Build order**: `@hfu.digital/boardkit-core` must build first — both `nestjs` and `react` depend on it (`"@hfu.digital/boardkit-core": "workspace:*"`) and declare TypeScript project references (`"references": [{ "path": "../core" }]`). Turbo's `^build` dependency enforces this automatically; `core/tsconfig.json` sets `"composite": true` so its `.d.ts` output is consumable.

## Code Style

- **4-space indentation** everywhere; TypeScript strict mode.
- Linter/formatter is **ESLint** (flat config `eslint.config.js` at the root, with `typescript-eslint` + `eslint-plugin-react-hooks`). This is a per-repo deviation from the Biome default used by the apps.
- `"module": "ESNext"`, `"moduleResolution": "bundler"` (in `tsconfig.base.json`) — use standard ESM imports, no `.js` extensions needed.

## Architecture

BoardKit is a collaborative whiteboard library organized as a Turborepo monorepo (`boardkit-monorepo`) with three published packages:

### `@hfu.digital/boardkit-core` — Zero-dependency shared kernel
Pure TypeScript, no runtime dependencies (`devDependencies`: typescript, vitest only). `src/` layout: `types/`, `scene/`, `tools/`, `operations/`, `geometry/`, `drawing/`, `renderer/`, `validation/`, `fixtures/`.
- **Types** (`types/`): `Element` discriminated union with `ElementType = 'stroke' | 'shape' | 'linear' | 'text' | 'image' | 'group'` (`shape` has `shapeType: rectangle | diamond | ellipse`; `linear` has `linearType: line | arrow`). Also `board.ts`, `collaboration.ts`, `events.ts`, `styles.ts`, and the WebSocket `protocol.ts` (`ClientMessage`/`ServerMessage`).
- **Scene graph** (`scene/`): Immutable scene state = element map + `elementOrder: string[]`. Mutations return new state objects.
- **Tools** (`tools/`): Abstract `Tool` (in `tool.interface.ts`) with a `readonly id` string and an `idle → active → finishing → idle` state machine. Each tool processes input and returns a result with mutations + preview elements. `ToolRegistry.createDefault()` registers 11 tools: `SelectTool`, `RectangleTool`, `DiamondTool`, `EllipseTool`, `ArrowTool`, `LineTool`, `PenTool`, `TextTool`, `ImageTool`, `EraserTool`, `LaserTool`. Shared base classes: `linear-tool.base.ts`, `rect-shape-tool.base.ts`. There is **no** `HAND` tool — viewport panning is implemented in the react input pipeline (space+drag), not as a registered Tool.
- **Operations** (`operations/`): LWW (Last-Writer-Wins) merge for collaboration conflicts, undo/redo history, binding resolution for connectors.
- **Geometry/drawing/validation**: bounds, perimeter, z-order, alignment/snap helpers, element validation.

### `@hfu.digital/boardkit-nestjs` — Backend NestJS DynamicModule
Registered via `BoardModule.register(options)` (exports `BoardModule`, `BOARD_MODULE_OPTIONS`, `BoardModuleOptions`). `src/` layout: `interfaces/`, `adapters/`, `controllers/`, `realtime/`, `domain/`, `dto/`, `middleware/`, `testing/`.
- **Abstract interfaces** (`interfaces/`): `BoardStorage`, `AssetStorage`, `EventLogStorage`, `BoardAuthGuard`, `RealtimeTransport`. Consumers implement these. **Never imports `@prisma/client`** — Prisma adapters use structural typing only.
- **Controllers** (`controllers/`): `board`, `page`, `asset`, `share`, `export`. Permission model viewer < editor < owner, enforced via `BoardAuthGuard`.
- **Realtime** (`realtime/`): Socket.IO gateway (`board.gateway.ts`) plus `presence.manager.ts`, `sync-relay.ts`, `reconnection.handler.ts`. Protocol typed in `boardkit-core`. Peer deps: `@nestjs/common|core|websockets|platform-socket.io` (`^10 || ^11`), `rxjs ^7`.
- **Testing utilities** (`testing/`): `InMemoryBoardStorage`, `InMemoryAssetStorage`, `InMemoryEventLog`, `MockAuthGuard` for unit tests without a database.

### `@hfu.digital/boardkit-react` — React component library (Vite library mode)
`src/` layout: `store/`, `engine/` (incl. `element-renderers/`), `context/`, `components/`, `hooks/`, `gestures/`, `lib/`, `styles/`, `__tests__/`. Ships a CSS file (`./styles.css` → `dist/boardkit.css`). Peer deps: `react`/`react-dom` (`^18 || ^19`), `socket.io-client ^4`, `lucide-react`; runtime dep `roughjs`.
- **BoardStore** (`store/board-store.ts`): Mutable store living **outside React** with slice-based pub/sub; hooks bridge in via `useSyncExternalStore`.
- **Rendering engine** (`engine/`): `Canvas2DRenderer` with stacked `static-layer` (re-renders on scene change) and `interactive-layer` (per-frame previews/cursors). Helpers: `grid-renderer`, `alignment-renderer`, `asset-resolver`, `viewport`, `roughjs-helpers`, `element-renderers/`.
- **Input pipeline** (`engine/input-pipeline.ts` + `gestures/`): translates DOM PointerEvents → input events, handles space+drag pan and wheel zoom, dispatches to the active `Tool`.
- **Context**: `BoardKitProvider` (`context/BoardKitProvider.tsx`) instantiates the store, renderer, and tool registry via stable refs; hooks access them through `useBoardKit()`.
- **Hooks** (`hooks/`): `useBoard`, `useCollaboration`, `useViewport`, `useTool`, `useHistory`, `useGrid`, `useFollowMode`, `useImageImport`, `useErrorRecovery`, `useSelection`, `useElementMutations`, `usePresence`, `useExport`, `usePageNavigation`, `useTextEditor`, `useKeyboardShortcuts`, `useContextMenu`, `useTheme`.

### Data flow
```
PointerEvent → InputPipeline → GestureRecognizer → active Tool
  → result { mutations, preview }
  → BoardStore [applies mutations]
  → Canvas2DRenderer [static-layer invalidation]
  → useCollaboration sends mutations via Socket.IO
  → Server applies LWW merge, broadcasts to other clients
```

### Collaboration protocol (Socket.IO)
Defined in `core/src/types/protocol.ts`.
- **Client → server**: `join`, `leave`, `mutate`, `cursor`, `pageSwitch`, `ping`.
- **Server → client**: `joined`, `sync:full`, `sync:delta`, `mutation:ack`, `mutation:broadcast`, `cursor:broadcast`, `participant:joined`, `participant:left`, `rate-limited`, `error`, `pong`.

## Downstream consumers

`@hfu.digital/boardkit-*` are published to npm and consumed by HFU apps (e.g., `api/` for the NestJS server module, `website/` and `mobile/` for the React UI). Always pin exact CalVer versions in consumer `package.json`.
