# BoardKit — Claude Code Implementation Plan

> Adapted from the Kit Library Scaffold skill for the BoardKit whiteboard architecture.
> This document is the step-by-step execution guide for Claude Code sessions.

---

## How to Use This Plan

Each **Sprint** is a self-contained Claude Code session (or series of sessions). Within each sprint, **Tasks** are ordered by dependency — complete them top-to-bottom. Each task includes:

- **Package** — which workspace package to work in
- **Files** — exact files to create or modify
- **Depends on** — which prior tasks must be done first
- **Acceptance** — how to verify the task is complete (build, test, or manual check)

### Key Adaptations from Standard Kit Skill

The standard Kit skill produces 2 packages (`backend` + `frontend`) with a simple CRUD flow. BoardKit diverges in these ways that Claude Code must respect throughout:

| Standard Kit Pattern | BoardKit Adaptation |
|---|---|
| 2 packages: `@scope/name-nestjs` + `@scope/name-react` | 3 packages: `@boardkit/core` + `@boardkit/nestjs` + `@boardkit/react` |
| Single `KitStorage` abstract class | 3 storage ports: `BoardStorage`, `AssetStorage`, `EventLogStorage` |
| REST-only data flow | WebSocket for realtime + REST for persistence |
| Thin frontend hooks over API | Heavy canvas engine — frontend IS the product |
| Simple `register({ storage })` | Extended `register()` with storage, auth, limits, sync, deployment config |
| No shared types package | `@boardkit/core` serves as shared types + logic layer |
| `react/jsx-runtime` as only external | `@boardkit/core` is a real dependency (not peer) for both nestjs and react |

### Hard Rules (inherited from Kit Skill + BoardKit-specific)

1. **NEVER `import` from `@prisma/client`** — structural typing only in adapters
2. **NEVER bundle NestJS or React** — always `peerDependencies`
3. **NEVER use Next.js-specific imports** in `@boardkit/react`
4. **ALWAYS use abstract classes** for storage interfaces (NestJS DI tokens)
5. **ALWAYS use `DynamicModule.register()`** for the NestJS module
6. **ALWAYS barrel export** via `index.ts` — only export the public API
7. **ALWAYS use Vite Library Mode** for the React package build
8. **`@boardkit/core` must have ZERO dependencies** — pure TypeScript only
9. **Canvas state lives OUTSIDE React** — mutable store, not useState/useReducer
10. **Event log writes from day one** — even before version history UI exists

---

## Sprint 0 — Foundation

**Goal:** Monorepo scaffolded, all types defined, storage interfaces written, in-memory adapters working, full build pipeline green.

---

### Task 0.1 — Scaffold Monorepo Root

**Package:** root
**Depends on:** nothing
**Files to create:**

```
/boardkit/
├── package.json
├── turbo.json
├── tsconfig.base.json
├── .gitignore
├── .npmrc
├── LICENSE
└── README.md
```

**Instructions:**

1. `package.json` — workspace root, private, workspaces: `["packages/*", "examples/*"]`
   - devDependencies: `turbo@^2.0.0`, `typescript@^5.0.0`
   - scripts: `build`, `dev`, `lint`, `test`, `clean`
   - **name:** `boardkit-monorepo`, **private:** true

2. `turbo.json` — pipeline config:
   ```json
   {
     "$schema": "https://turbo.build/schema.json",
     "tasks": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**"]
       },
       "dev": {
         "cache": false,
         "persistent": true
       },
       "lint": {},
       "test": {
         "dependsOn": ["build"]
       },
       "clean": {
         "cache": false
       }
     }
   }
   ```
   Note: Turbo v2 uses `"tasks"` not `"pipeline"`.

3. `tsconfig.base.json` — shared compiler options:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "lib": ["ES2022"],
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true,
       "outDir": "dist",
       "rootDir": "src"
     }
   }
   ```

4. `.gitignore` — node_modules, dist, .turbo, *.tsbuildinfo
5. `.npmrc` — `auto-install-peers=true`
6. `LICENSE` — MIT

**Acceptance:** `npm install` succeeds, `npx turbo build` runs (no packages yet, but no errors).

---

### Task 0.2 — Scaffold `@boardkit/core` Package

**Package:** `packages/core`
**Depends on:** 0.1
**Files to create:**

```
packages/core/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts          # Empty barrel, will be populated in 0.3
```

**Instructions:**

1. `package.json`:
   ```json
   {
     "name": "@boardkit/core",
     "version": "0.1.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "files": ["dist"],
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch",
       "clean": "rm -rf dist",
       "lint": "eslint src/",
       "prepublishOnly": "npm run build"
     },
     "devDependencies": {
       "typescript": "^5.0.0"
     }
   }
   ```
   **ZERO runtime dependencies.** This package runs in Node and browser.

2. `tsconfig.json` — extends `../../tsconfig.base.json`, adds `"lib": ["ES2022", "DOM"]` (for types like `DOMHighResTimeStamp` used in input events — but NO DOM API calls at runtime).

**Acceptance:** `cd packages/core && npm run build` succeeds with empty barrel.

---

### Task 0.3 — Define All Core Types

**Package:** `packages/core`
**Depends on:** 0.2
**Files to create:**

```
packages/core/src/
├── types/
│   ├── board.ts
│   ├── elements.ts
│   ├── styles.ts
│   ├── collaboration.ts
│   ├── events.ts
│   └── protocol.ts
├── constants.ts
└── index.ts              # Updated barrel
```

**Instructions — `types/board.ts`:**
Define all board-level entities. These mirror the Prisma schema but are plain TS types (no Prisma imports). Key types:

```typescript
// All IDs are strings (cuid)
export interface Board {
  id: string;
  name: string;
  ownerId: string;
  sessionType: 'ephemeral' | 'persistent';
  isArchived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface Page {
  id: string;
  boardId: string;
  name: string;
  order: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  boardId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface ShareLink {
  id: string;
  boardId: string;
  token: string;
  permission: 'view' | 'edit';
  expiresAt?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  boardId: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
}
```

**Instructions — `types/elements.ts`:**
Define the element union type. Every element has a common base, with type-specific `data`:

```typescript
export interface ElementBase {
  id: string;
  pageId: string;
  type: ElementType;
  zIndex: number;
  lockedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ElementType = 'stroke' | 'shape' | 'text' | 'image' | 'stickyNote' | 'group';

export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; height: number; }

export interface StrokeElement extends ElementBase {
  type: 'stroke';
  data: {
    points: Point[];
    pressures?: number[];
    style: StrokeStyle;
    bounds: Rect;
  };
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  data: {
    shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'triangle';
    position: Point;
    size: { width: number; height: number };
    rotation: number;
    style: ShapeStyle;
    bounds: Rect;
  };
}

export interface TextElement extends ElementBase {
  type: 'text';
  data: {
    content: string;
    position: Point;
    size: { width: number; height: number };
    rotation: number;
    style: TextStyle;
    bounds: Rect;
  };
}

export interface ImageElement extends ElementBase {
  type: 'image';
  data: {
    assetId: string;
    url: string;
    position: Point;
    size: { width: number; height: number };
    rotation: number;
    bounds: Rect;
  };
}

export interface StickyNoteElement extends ElementBase {
  type: 'stickyNote';
  data: {
    content: string;
    position: Point;
    size: { width: number; height: number };
    color: string;
    style: TextStyle;
    bounds: Rect;
  };
}

export interface GroupElement extends ElementBase {
  type: 'group';
  data: {
    childIds: string[];
    bounds: Rect;
  };
}

export type Element = StrokeElement | ShapeElement | TextElement | ImageElement | StickyNoteElement | GroupElement;
```

**Instructions — `types/styles.ts`:**
```typescript
export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
}

export interface FillStyle {
  type: 'solid' | 'none';
  color: string;
  opacity: number;
}

export interface ShapeStyle {
  stroke: StrokeStyle;
  fill: FillStyle;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
}
```

**Instructions — `types/collaboration.ts`:**
```typescript
export interface Participant {
  userId: string;
  displayName: string;
  color: string;
  cursorPosition?: Point;
  activePageId?: string;
  activeTool?: string;
  viewportBounds?: Rect;
  joinedAt: string;
}

export interface CursorPosition {
  userId: string;
  position: Point;
  pageId: string;
}
```

**Instructions — `types/events.ts`:**
```typescript
export interface BoardEvent {
  id: string;
  boardId: string;
  pageId?: string;
  type: BoardEventType;
  payload: Record<string, unknown>;
  userId: string;
  sequence: number;
  timestamp: string;
}

export type BoardEventType =
  | 'elementCreated'
  | 'elementUpdated'
  | 'elementDeleted'
  | 'pageAdded'
  | 'pageRemoved'
  | 'pageReordered'
  | 'boardUpdated';

export interface BoardSnapshot {
  id: string;
  boardId: string;
  snapshotData: Record<string, unknown>;
  eventSequence: number;
  createdAt: string;
}

export interface ElementMutation {
  type: 'create' | 'update' | 'delete';
  elementId: string;
  pageId: string;
  data?: Partial<Element>;
  timestamp: number;
}
```

**Instructions — `types/protocol.ts`:**
Copy the WebSocket protocol types from the final plan verbatim (ClientMessage, ServerMessage unions). Add `PROTOCOL_VERSION = 1` constant.

**Instructions — `constants.ts`:**
Define tool IDs, default styles, limits, protocol version. Key constants:
- `DEFAULT_STROKE_STYLE`, `DEFAULT_FILL_STYLE`, `DEFAULT_TEXT_STYLE`
- `TOOL_IDS`: `{ PEN, SHAPE, SELECT, ERASER, TEXT, HAND }`
- `LIMITS`: `{ MAX_ELEMENTS_PER_PAGE: 10_000, MAX_PAGES_PER_BOARD: 100, MAX_ASSET_SIZE_MB: 25, MAX_BOARD_SIZE_MB: 100 }`

**Instructions — `index.ts`:**
Barrel export ALL types, constants. Group exports logically:
```typescript
// Types
export * from './types/board';
export * from './types/elements';
export * from './types/styles';
export * from './types/collaboration';
export * from './types/events';
export * from './types/protocol';

// Constants
export * from './constants';
```

**Acceptance:** `npm run build` in core succeeds. All types compile cleanly. No runtime dependencies.

---

### Task 0.4 — Scaffold `@boardkit/nestjs` Package

**Package:** `packages/nestjs`
**Depends on:** 0.2, 0.3
**Files to create:**

```
packages/nestjs/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

**Instructions:**

1. `package.json`:
   ```json
   {
     "name": "@boardkit/nestjs",
     "version": "0.1.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "files": ["dist"],
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch",
       "clean": "rm -rf dist",
       "lint": "eslint src/",
       "prepublishOnly": "npm run build"
     },
     "dependencies": {
       "@boardkit/core": "workspace:*"
     },
     "peerDependencies": {
       "@nestjs/common": "^10.0.0 || ^11.0.0",
       "@nestjs/core": "^10.0.0 || ^11.0.0",
       "@nestjs/websockets": "^10.0.0 || ^11.0.0",
       "@nestjs/platform-socket.io": "^10.0.0 || ^11.0.0",
       "rxjs": "^7.0.0"
     },
     "devDependencies": {
       "@nestjs/common": "^10.0.0",
       "@nestjs/core": "^10.0.0",
       "@nestjs/websockets": "^10.0.0",
       "@nestjs/platform-socket.io": "^10.0.0",
       "rxjs": "^7.0.0",
       "typescript": "^5.0.0"
     }
   }
   ```
   Note: `@boardkit/core` is a real `dependency`, not a peer. NestJS packages are peers.

2. `tsconfig.json` — extends base, `"lib": ["ES2022"]` (no DOM needed on server). Add `"paths"` if needed for workspace resolution, or rely on npm workspaces.

**Acceptance:** `npm run build` succeeds with empty barrel.

---

### Task 0.5 — Define Storage Interfaces (Backend)

**Package:** `packages/nestjs`
**Depends on:** 0.4
**Files to create:**

```
packages/nestjs/src/
├── interfaces/
│   ├── board-storage.interface.ts
│   ├── asset-storage.interface.ts
│   ├── event-log-storage.interface.ts
│   ├── auth-guard.interface.ts
│   └── realtime-transport.interface.ts
└── index.ts   # Updated
```

**Critical rule:** ALL storage interfaces are `abstract class` (not `interface`) so NestJS DI can use them as injection tokens.

**Instructions — `board-storage.interface.ts`:**
```typescript
import {
  Board, Page, Element, BoardMember, ShareLink,
  ElementMutation, Rect
} from '@boardkit/core';

export interface CreateBoardInput {
  name: string;
  ownerId: string;
  sessionType?: 'ephemeral' | 'persistent';
}

export interface CreatePageInput {
  name?: string;
  order: number;
}

export interface BoardFilters {
  ownerId?: string;
  isArchived?: boolean;
  sessionType?: 'ephemeral' | 'persistent';
}

export interface ElementUpsert {
  id: string;
  pageId: string;
  type: string;
  data: Record<string, unknown>;
  zIndex: number;
  createdBy: string;
}

export abstract class BoardStorage {
  // Board CRUD
  abstract createBoard(data: CreateBoardInput): Promise<Board>;
  abstract getBoard(id: string): Promise<Board | null>;
  abstract listBoards(filters: BoardFilters): Promise<Board[]>;
  abstract updateBoard(id: string, data: Partial<Board>): Promise<Board>;
  abstract deleteBoard(id: string): Promise<void>;

  // Page operations
  abstract createPage(boardId: string, data: CreatePageInput): Promise<Page>;
  abstract getPages(boardId: string): Promise<Page[]>;
  abstract getPage(id: string): Promise<Page | null>;
  abstract reorderPages(boardId: string, pageIds: string[]): Promise<void>;
  abstract deletePage(id: string): Promise<void>;

  // Element operations (batch-friendly for sync)
  abstract upsertElements(pageId: string, elements: ElementUpsert[]): Promise<void>;
  abstract getElements(pageId: string): Promise<Element[]>;
  abstract deleteElements(ids: string[]): Promise<void>;

  // Permissions
  abstract setMember(boardId: string, userId: string, role: string): Promise<void>;
  abstract getMembers(boardId: string): Promise<BoardMember[]>;
  abstract getMemberRole(boardId: string, userId: string): Promise<string | null>;
  abstract removeMember(boardId: string, userId: string): Promise<void>;

  // Share links
  abstract createShareLink(data: {
    boardId: string;
    permission: 'view' | 'edit';
    expiresAt?: string;
  }): Promise<ShareLink>;
  abstract resolveShareLink(token: string): Promise<ShareLink | null>;
  abstract deleteShareLink(id: string): Promise<void>;
}
```

**Instructions — `asset-storage.interface.ts`:**
```typescript
import { Asset } from '@boardkit/core';

export interface AssetMeta {
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export abstract class AssetStorage {
  abstract upload(boardId: string, file: Buffer, meta: AssetMeta): Promise<Asset>;
  abstract getUrl(storageKey: string): Promise<string>;
  abstract delete(storageKey: string): Promise<void>;
  abstract getBoardUsage(boardId: string): Promise<number>;
}
```

**Instructions — `event-log-storage.interface.ts`:**
```typescript
import { BoardEvent, BoardSnapshot } from '@boardkit/core';

export abstract class EventLogStorage {
  abstract append(event: Omit<BoardEvent, 'id'>): Promise<BoardEvent>;
  abstract appendBatch(events: Omit<BoardEvent, 'id'>[]): Promise<BoardEvent[]>;
  abstract getEvents(boardId: string, afterSequence?: number): Promise<BoardEvent[]>;
  abstract getLatestSequence(boardId: string): Promise<number>;
  abstract createSnapshot(boardId: string, data: Record<string, unknown>, eventSequence: number): Promise<BoardSnapshot>;
  abstract getLatestSnapshot(boardId: string): Promise<BoardSnapshot | null>;
}
```

**Instructions — `auth-guard.interface.ts`:**
```typescript
export interface AuthenticatedUser {
  userId: string;
  displayName: string;
}

export abstract class BoardAuthGuard {
  abstract validateConnection(token: string): Promise<AuthenticatedUser | null>;
  abstract validateRequest(token: string): Promise<AuthenticatedUser | null>;
}
```

**Instructions — `realtime-transport.interface.ts`:**
```typescript
import { ClientMessage, ServerMessage } from '@boardkit/core';

export interface TransportConnection {
  id: string;
  userId: string;
  send(message: ServerMessage): void;
  close(): void;
}

export abstract class RealtimeTransport {
  abstract onConnection(handler: (conn: TransportConnection, message: ClientMessage) => void): void;
  abstract onDisconnection(handler: (conn: TransportConnection) => void): void;
  abstract broadcast(boardId: string, message: ServerMessage, excludeConnectionId?: string): void;
}
```

**Update `index.ts`** to barrel-export all interfaces.

**Acceptance:** `npm run build` succeeds. All abstract classes compile. No `@prisma/client` imports anywhere.

---

### Task 0.6 — Build In-Memory Test Adapters

**Package:** `packages/nestjs`
**Depends on:** 0.5
**Files to create:**

```
packages/nestjs/src/testing/
├── in-memory-board-storage.ts
├── in-memory-event-log.ts
├── in-memory-asset-storage.ts
├── mock-auth-guard.ts
└── index.ts
```

**Instructions:**

Implement all abstract methods using plain Maps/arrays. These enable the entire Kit to work without a database — critical for:
- Unit tests
- Frontend-only development
- Example apps

Key implementation notes:
- `InMemoryBoardStorage`: Use `Map<string, Board>`, `Map<string, Page>`, `Map<string, Element[]>`, etc. Generate IDs with `crypto.randomUUID()` or a simple counter.
- `InMemoryEventLogStorage`: Array of events per board, monotonically increasing sequence counters.
- `InMemoryAssetStorage`: Store buffers in a Map, return `data:` URLs from `getUrl()`.
- `MockAuthGuard`: Accept any token, extract userId from it (e.g., treat the token as the userId), always return valid.

**Acceptance:** All adapters implement their abstract class fully. Build succeeds. Export from `testing/index.ts` and re-export from main `index.ts` under a `testing` path or as named exports.

---

### Task 0.7 — Scaffold `@boardkit/react` Package

**Package:** `packages/react`
**Depends on:** 0.3
**Files to create:**

```
packages/react/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    └── index.ts
```

**Instructions:**

1. `package.json`:
   ```json
   {
     "name": "@boardkit/react",
     "version": "0.1.0",
     "main": "dist/index.js",
     "module": "dist/index.es.js",
     "types": "dist/index.d.ts",
     "files": ["dist"],
     "scripts": {
       "build": "vite build",
       "dev": "vite build --watch",
       "clean": "rm -rf dist",
       "lint": "eslint src/",
       "prepublishOnly": "npm run build"
     },
     "dependencies": {
       "@boardkit/core": "workspace:*"
     },
     "peerDependencies": {
       "react": "^18.0.0 || ^19.0.0",
       "react-dom": "^18.0.0 || ^19.0.0"
     },
     "devDependencies": {
       "react": "^18.0.0",
       "react-dom": "^18.0.0",
       "@types/react": "^18.0.0",
       "@types/react-dom": "^18.0.0",
       "vite": "^5.0.0",
       "@vitejs/plugin-react": "^4.0.0",
       "vite-plugin-dts": "^3.0.0",
       "typescript": "^5.0.0"
     }
   }
   ```

2. `vite.config.ts` — Library mode, externalize React + react-dom + react/jsx-runtime AND `@boardkit/core`:
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import dts from 'vite-plugin-dts';
   import { resolve } from 'path';

   export default defineConfig({
     plugins: [react(), dts({ rollupTypes: true })],
     build: {
       lib: {
         entry: resolve(__dirname, 'src/index.ts'),
         name: 'BoardKitReact',
         formats: ['es', 'cjs'],
         fileName: (format) => `index.${format === 'es' ? 'es.' : ''}js`,
       },
       rollupOptions: {
         external: [
           'react', 'react-dom', 'react/jsx-runtime',
           '@boardkit/core',
         ],
         output: {
           globals: {
             react: 'React',
             'react-dom': 'ReactDOM',
             '@boardkit/core': 'BoardKitCore',
           },
         },
       },
     },
   });
   ```

**Acceptance:** `npm run build` succeeds. Output in `dist/`.

---

### Task 0.8 — Create Core Fixture Boards

**Package:** `packages/core`
**Depends on:** 0.3
**Files to create:**

```
packages/core/src/
├── fixtures/
│   ├── empty-board.ts
│   ├── simple-board.ts
│   ├── dense-board.ts
│   └── index.ts
└── index.ts  # Updated to export fixtures
```

**Instructions:**

Create factory functions (not static objects) so each test gets a fresh copy:
- `createEmptyBoard()` — 1 page, 0 elements
- `createSimpleBoard()` — 2 pages, 10 elements (mix of strokes, shapes, text)
- `createDenseBoard()` — 1 page, 2000 elements (auto-generated strokes)
- `createStressBoard()` — 1 page, 5000+ elements

Each returns `{ board: Board, pages: Page[], elements: Map<string, Element[]> }`.

**Acceptance:** Build succeeds. Fixtures are importable from `@boardkit/core`.

---

### Task 0.9 — CI Workflow + Publish Workflow

**Package:** root
**Depends on:** 0.1
**Files to create:**

```
.github/workflows/
├── ci.yml
└── publish.yml
```

**Instructions — `ci.yml`:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo build
      - run: npx turbo lint
      - run: npx turbo test
```

**Instructions — `publish.yml`:**
Publish all 3 packages on tag push. Order matters because of workspace dependencies:
```yaml
name: Publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npx turbo build
      - run: npm publish --workspace=packages/core --access public
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
      - run: npm publish --workspace=packages/nestjs --access public
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
      - run: npm publish --workspace=packages/react --access public
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
```

**Acceptance:** Workflows are valid YAML. `npx turbo build` from root succeeds across all 3 packages.

---

### Sprint 0 Checkpoint

At this point you should be able to run:
```bash
cd boardkit
npm install
npx turbo build
```
And get clean builds for `@boardkit/core`, `@boardkit/nestjs`, `@boardkit/react`.

The full type system is defined, storage contracts are locked, and in-memory adapters exist for testing. **No business logic yet** — that's Sprint 1.

---

## Sprint 1–2 — Core Engine (Single-User Canvas)

**Goal:** Working single-user whiteboard with pen, shapes, select, eraser, text, undo/redo, and viewport pan/zoom. No collaboration yet.

---

### Task 1.1 — Scene Graph Operations

**Package:** `packages/core`
**Depends on:** 0.3
**Files to create:**

```
packages/core/src/scene/
├── scene-graph.ts
├── z-order.ts
├── bounds.ts
├── spatial-index.ts
└── serialization.ts
```

**Instructions — `scene-graph.ts`:**

The scene graph is a flat map of elements per page (not a tree — groups reference children by ID). All operations are **pure functions** that take state in and return new state:

```typescript
export interface SceneState {
  elements: Map<string, Element>;
  elementOrder: string[]; // z-order sorted IDs
}

// Pure functions:
export function addElement(scene: SceneState, element: Element): SceneState;
export function removeElement(scene: SceneState, id: string): SceneState;
export function updateElement(scene: SceneState, id: string, patch: Partial<Element>): SceneState;
export function getElement(scene: SceneState, id: string): Element | undefined;
export function getElementsByPage(scene: SceneState, pageId: string): Element[];
```

**Instructions — `bounds.ts`:**
Bounding box math — all pure functions:
- `calculateBounds(element: Element): Rect`
- `boundsIntersect(a: Rect, b: Rect): boolean`
- `boundsContain(outer: Rect, inner: Rect): boolean`
- `pointInBounds(point: Point, bounds: Rect): boolean`
- `expandBounds(bounds: Rect, padding: number): Rect`
- `mergeBounds(bounds: Rect[]): Rect`

**Instructions — `z-order.ts`:**
- `bringToFront(scene: SceneState, id: string): SceneState`
- `sendToBack(scene: SceneState, id: string): SceneState`
- `bringForward(scene: SceneState, id: string): SceneState`
- `sendBackward(scene: SceneState, id: string): SceneState`
- `reorder(scene: SceneState, orderedIds: string[]): SceneState`

**Instructions — `spatial-index.ts`:**
Implement a simple quadtree or grid-based spatial index for fast viewport culling and hit testing:
- `createSpatialIndex(elements: Element[]): SpatialIndex`
- `queryRect(index: SpatialIndex, rect: Rect): string[]` — returns element IDs in viewport
- `queryPoint(index: SpatialIndex, point: Point): string[]` — returns elements at point (hit testing)
- `rebuild(index: SpatialIndex, elements: Element[]): SpatialIndex`

Start with a simple grid (faster to implement than quadtree, good enough for <10k elements).

**Instructions — `serialization.ts`:**
- `serializeBoard(board: Board, pages: Page[], elements: Map<string, Element[]>): string` — JSON
- `deserializeBoard(json: string): { board: Board; pages: Page[]; elements: Map<string, Element[]> }`
- Validate shapes on deserialization

**Acceptance:** All functions compile. Write unit tests for bounds math and z-order operations using fixture boards.

---

### Task 1.2 — Drawing Algorithms

**Package:** `packages/core`
**Depends on:** 0.3
**Files to create:**

```
packages/core/src/drawing/
├── smoothing.ts
├── simplify.ts
└── pressure.ts
```

**Instructions — `smoothing.ts`:**
Catmull-Rom spline interpolation for pen strokes. Takes raw points, returns smooth curve points.
- `smoothPoints(points: Point[], tension?: number): Point[]`
- Tension default: 0.5

**Instructions — `simplify.ts`:**
Ramer-Douglas-Peucker algorithm for point reduction. Reduces stroke point count after drawing completes.
- `simplifyPoints(points: Point[], tolerance?: number): Point[]`
- Tolerance default: 1.0 (pixels)

**Instructions — `pressure.ts`:**
Maps pen pressure (0–1) to stroke width.
- `pressureToWidth(pressure: number, baseWidth: number, minMultiplier?: number, maxMultiplier?: number): number`
- Default min: 0.3, max: 1.5

**Acceptance:** Unit tests pass. Smoothing visually tested with sample data.

---

### Task 1.3 — Tool State Machines

**Package:** `packages/core`
**Depends on:** 1.1, 1.2
**Files to create:**

```
packages/core/src/tools/
├── tool.interface.ts
├── pen.tool.ts
├── shape.tool.ts
├── select.tool.ts
├── eraser.tool.ts
├── text.tool.ts
└── tool-registry.ts
```

**Instructions — `tool.interface.ts`:**

Define the abstract tool state machine. Every tool follows: `idle → active → finishing → idle`.

```typescript
export interface InputEvent {
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel';
  position: Point;
  pressure?: number;
  tilt?: { x: number; y: number };
  button: number;
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
  timestamp: number;
}

export type ToolState = 'idle' | 'active' | 'finishing';

export interface ToolResult {
  /** Elements to add/update/remove in the scene */
  mutations?: ElementMutation[];
  /** Visual preview to render on the interactive layer (not persisted) */
  preview?: Element[];
  /** Cursor style to show */
  cursor?: string;
  /** New tool state */
  state: ToolState;
}

export abstract class Tool {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract state: ToolState;

  abstract onPointerDown(event: InputEvent, scene: SceneState): ToolResult;
  abstract onPointerMove(event: InputEvent, scene: SceneState): ToolResult;
  abstract onPointerUp(event: InputEvent, scene: SceneState): ToolResult;
  abstract onCancel(): ToolResult;
}
```

**Instructions — `pen.tool.ts`:**
- On pointerDown: start collecting points, set state = 'active'
- On pointerMove (while active): append point (with pressure), return preview stroke
- On pointerUp: smooth points, simplify, create final StrokeElement mutation
- Apply smoothing from `drawing/smoothing.ts` and simplification from `drawing/simplify.ts`

**Instructions — `shape.tool.ts`:**
- On pointerDown: record start position, set state = 'active'
- On pointerMove: compute shape from start to current position, return preview
- On pointerUp: finalize ShapeElement mutation
- Support: rectangle, ellipse, line, arrow, triangle
- Shift modifier: constrain to square/circle/45° line

**Instructions — `select.tool.ts`:**
- On pointerDown over element: start drag, set state = 'active'
- On pointerDown over empty: start rubber-band selection
- On pointerMove: move selected elements or expand selection rect
- On pointerUp: finalize position changes as mutations
- Support: multi-select with shift+click, rubber-band selection

**Instructions — `eraser.tool.ts`:**
- On pointerDown/Move: check hit testing against elements at cursor position
- Delete intersecting elements
- Two modes: point eraser (single click) and area eraser (drag)

**Instructions — `text.tool.ts`:**
- On pointerDown over empty: create new TextElement at position, signal to frontend to open text editor overlay
- On pointerDown over existing text: signal to frontend to open editor for that element
- The actual text editing happens in the React layer (HTML contenteditable)

**Instructions — `tool-registry.ts`:**
```typescript
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void;
  get(id: string): Tool | undefined;
  getAll(): Tool[];
  
  // Register all built-in tools
  static createDefault(): ToolRegistry;
}
```

**Acceptance:** All tool classes compile. Unit tests for pen smoothing, shape constraint, and select hit-testing pass.

---

### Task 1.4 — Operations (Undo/Redo, Clipboard, Transform)

**Package:** `packages/core`
**Depends on:** 1.1
**Files to create:**

```
packages/core/src/operations/
├── history.ts
├── clipboard.ts
├── transform.ts
└── merge.ts
```

**Instructions — `history.ts`:**
Command pattern with configurable depth:

```typescript
export interface Command {
  execute(): ElementMutation[];
  undo(): ElementMutation[];
}

export class History {
  constructor(private maxDepth: number = 100);
  push(command: Command): void;
  undo(): ElementMutation[] | null;
  redo(): ElementMutation[] | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

**Instructions — `clipboard.ts`:**
- `serializeSelection(elements: Element[]): string` — JSON with relative positions
- `deserializeSelection(data: string, pastePosition: Point): Element[]` — new IDs, offset to paste position

**Instructions — `transform.ts`:**
Pure functions for element manipulation:
- `moveElements(elements: Element[], delta: Point): Element[]`
- `resizeElement(element: Element, newBounds: Rect): Element`
- `rotateElement(element: Element, angleDelta: number, center: Point): Element`

**Instructions — `merge.ts`:**
LWW merge logic:
```typescript
export function mergeElement(local: Element, remote: Element): Element {
  // Compare updatedAt timestamps, return the newer one
  // If equal, remote wins (server authority)
}

export function mergeScene(local: SceneState, remote: ElementMutation[]): SceneState {
  // Apply remote mutations, using LWW per element
}
```

**Acceptance:** History undo/redo works in unit tests. LWW merge resolves conflicts correctly.

---

### Task 1.5 — Validation

**Package:** `packages/core`
**Depends on:** 0.3
**Files to create:**

```
packages/core/src/validation/
├── board.validator.ts
└── element.validator.ts
```

**Instructions:**
- Validate board size limits (element count, page count)
- Validate element data shapes (correct fields for each element type)
- Return typed error objects, not thrown exceptions
- `validateElement(data: unknown): { valid: boolean; errors: string[] }`
- `validateBoardLimits(elementCount: number, pageCount: number, limits: Limits): { valid: boolean; errors: string[] }`

**Acceptance:** Validators reject malformed data, accept valid data.

---

### Task 1.6 — Renderer Interface

**Package:** `packages/core`
**Depends on:** 0.3
**Files to create:**

```
packages/core/src/renderer/
└── renderer.interface.ts
```

**Instructions:**
```typescript
export interface RenderContext {
  viewport: { offset: Point; zoom: number };
  selectedIds: Set<string>;
  hoveredId?: string;
  activeTool: string;
}

export abstract class BoardRenderer {
  abstract initialize(container: HTMLElement): void;
  abstract resize(width: number, height: number): void;
  abstract renderStaticLayer(elements: Element[], context: RenderContext): void;
  abstract renderInteractiveLayer(
    preview: Element[],
    cursors: CursorPosition[],
    selections: Rect[],
    context: RenderContext
  ): void;
  abstract destroy(): void;
  abstract toDataURL(format?: string, quality?: number): string;
}
```

Note: This lives in `core` as the interface, but the Canvas 2D implementation lives in `@boardkit/react`.

**Acceptance:** Interface compiles. No DOM calls at runtime in core.

---

### Task 2.1 — Canvas 2D Renderer (React Package)

**Package:** `packages/react`
**Depends on:** 1.6, 1.1
**Files to create:**

```
packages/react/src/engine/
├── canvas-2d-renderer.ts
├── static-layer.ts
├── interactive-layer.ts
├── viewport.ts
├── input-pipeline.ts
└── element-renderers/
    ├── stroke.renderer.ts
    ├── shape.renderer.ts
    ├── text.renderer.ts
    ├── image.renderer.ts
    └── sticky-note.renderer.ts
```

**Instructions — `canvas-2d-renderer.ts`:**
Implements `BoardRenderer` from core. Creates two `<canvas>` elements stacked via CSS:
- Bottom canvas: static layer (re-rendered only when scene changes)
- Top canvas: interactive layer (re-rendered every rAF frame)

Uses `requestAnimationFrame` for the interactive layer. Tracks a "scene nonce" (incremented on every mutation) to know when to re-render the static layer.

**Instructions — `static-layer.ts`:**
Renders all non-interactive elements. Applies viewport transform (translate + scale). Uses element-specific renderers from `element-renderers/`. Implements viewport culling using spatial index from core — only renders elements whose bounds intersect the viewport.

**Instructions — `interactive-layer.ts`:**
Renders on every frame:
- Active stroke preview (while drawing)
- Selection rectangle (while rubber-band selecting)
- Selection handles (resize/rotate) on selected elements
- Remote cursors with name labels
- Any tool-specific overlays

**Instructions — `viewport.ts`:**
Manages pan/zoom state:
```typescript
export interface ViewportState {
  offset: Point;   // pan offset in screen pixels
  zoom: number;    // 1.0 = 100%
}

export function screenToWorld(point: Point, viewport: ViewportState): Point;
export function worldToScreen(point: Point, viewport: ViewportState): Point;
export function applyViewportTransform(ctx: CanvasRenderingContext2D, viewport: ViewportState): void;
export function zoomToPoint(viewport: ViewportState, point: Point, zoomDelta: number): ViewportState;
```

Zoom limits: 0.1 (10%) to 5.0 (500%).

**Instructions — `input-pipeline.ts`:**
Unified input normalization. All pointer/touch/pen events enter here and get converted to `InputEvent` from core:
```typescript
export class InputPipeline {
  constructor(canvas: HTMLCanvasElement, viewport: ViewportState);
  
  // Attaches event listeners, normalizes events
  attach(): void;
  detach(): void;
  
  // Callbacks
  onInput: (event: InputEvent) => void;
  onViewportChange: (gesture: 'pan' | 'zoom', delta: Point | number) => void;
}
```

Handles:
- Mouse events (primary input for desktop)
- Touch events (single finger = draw, two fingers = pan/zoom)
- Pen/stylus events (pressure, tilt, barrel button)
- Keyboard modifiers (shift, ctrl, alt)
- Converts screen coordinates to world coordinates via viewport

**Acceptance:** A bare `<canvas>` renders elements from a fixture board. Panning and zooming works with mouse wheel and drag.

---

### Task 2.2 — Gesture Recognition

**Package:** `packages/react`
**Depends on:** 2.1
**Files to create:**

```
packages/react/src/gestures/
├── gesture-recognizer.ts
├── mouse-handler.ts
├── touch-handler.ts
└── pen-handler.ts
```

**Instructions:**

The gesture recognizer sits between the input pipeline and tool dispatch. It decides whether input should go to:
- The active tool (drawing, selecting, erasing)
- The viewport controller (panning, zooming)

Rules:
- **Mouse:** left button → tool, middle button or space+left → pan, wheel → zoom
- **Touch:** single finger → tool, two fingers → pan/zoom
- **Pen:** tip → tool, barrel button → secondary action (e.g., eraser toggle)

**Acceptance:** Gestures correctly route to tool vs. viewport. Two-finger pinch zoom works.

---

### Task 2.3 — Board Store (Mutable State Outside React)

**Package:** `packages/react`
**Depends on:** 1.1
**Files to create:**

```
packages/react/src/store/
└── board-store.ts
```

**Instructions:**

This is the performance-critical state container. It holds the scene graph, viewport, tool state, and selection — all as **mutable data** that the canvas reads directly. React components subscribe to *slices* via a lightweight pub/sub.

```typescript
export interface BoardStoreState {
  board: Board | null;
  pages: Page[];
  activePageId: string | null;
  scene: SceneState;
  viewport: ViewportState;
  activeTool: string;
  toolConfig: Record<string, unknown>;
  selectedIds: Set<string>;
  hoveredId: string | null;
  history: History;
  participants: Map<string, Participant>;
  cursors: Map<string, CursorPosition>;
}

export class BoardStore {
  private state: BoardStoreState;
  private listeners: Map<string, Set<() => void>>;

  getState(): BoardStoreState;
  
  // Mutate and notify
  updateScene(fn: (scene: SceneState) => SceneState): void;
  updateViewport(fn: (vp: ViewportState) => ViewportState): void;
  setActiveTool(toolId: string): void;
  setSelection(ids: Set<string>): void;

  // Subscribe to specific slices
  subscribe(slice: string, listener: () => void): () => void;
  
  // Snapshot for React components
  useSlice<T>(selector: (state: BoardStoreState) => T): T;
}
```

**Why not Zustand/Jotai?** Keep zero external dependencies. The pattern is simple enough. If needed later, swap to Zustand — the API surface is compatible.

**Acceptance:** Store mutations trigger canvas re-render. React components get slice updates without full re-renders.

---

### Task 2.4 — Core React Components + Hooks

**Package:** `packages/react`
**Depends on:** 2.1, 2.2, 2.3
**Files to create:**

```
packages/react/src/
├── context/
│   └── BoardKitProvider.tsx
├── hooks/
│   ├── useBoard.ts
│   ├── useTool.ts
│   ├── useHistory.ts
│   ├── useViewport.ts
│   ├── useKeyboardShortcuts.ts
│   └── usePageNavigation.ts
├── components/
│   ├── BoardCanvas.tsx
│   ├── Toolbar.tsx
│   ├── PageNavigator.tsx
│   ├── SelectionHandles.tsx
│   └── TextEditor.tsx
└── index.ts
```

**Instructions — `BoardKitProvider.tsx`:**
```typescript
interface BoardKitConfig {
  apiUrl: string;
  wsUrl?: string;
  authToken?: string;
  theme?: Partial<BoardKitTheme>;
}
```

Creates the BoardStore, initializes the renderer, provides context to all child components.

**Instructions — `BoardCanvas.tsx`:**
The main component. Mounts the canvas engine, attaches input pipeline, connects store to renderer. Accepts `className` and `style` props for sizing.

```tsx
export interface BoardCanvasProps {
  boardId: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}
```

**Instructions — `Toolbar.tsx`:**
Tool selection UI. Renders tool buttons, color picker, stroke width slider. All styling via `className` — no hardcoded CSS framework. Accepts `className` prop.

**Instructions — hooks:**
- `useBoard(boardId)` — loads board data, returns `{ board, pages, loading, error }`
- `useTool()` — `{ activeTool, setTool, toolConfig, setToolConfig }`
- `useHistory()` — `{ undo, redo, canUndo, canRedo }`
- `useViewport()` — `{ viewport, panTo, zoomTo, fitToContent, resetZoom }`
- `useKeyboardShortcuts()` — binds Ctrl+Z, Ctrl+Y, Delete, Ctrl+C/V, etc.
- `usePageNavigation()` — `{ pages, activePage, switchPage, addPage, deletePage, reorderPages }`

**Acceptance:** A single-user whiteboard works: draw strokes, place shapes, select/move/resize elements, undo/redo, pan/zoom, switch pages. No collaboration or persistence yet — all state is in-memory via the store.

---

## Sprint 3–4 — Persistence

**Goal:** Boards save to a database and load back. REST API for board management. Asset upload pipeline.

---

### Task 3.1 — Prisma Board Adapter

**Package:** `packages/nestjs`
**Depends on:** 0.5
**Files to create:**

```
packages/nestjs/src/adapters/
├── prisma-board.adapter.ts
└── prisma-event-log.adapter.ts
```

**Instructions — `prisma-board.adapter.ts`:**

**STRUCTURAL TYPING ONLY.** Define Prisma delegate shapes locally:

```typescript
type PrismaBoardDelegate = {
  create: (args: { data: any }) => Promise<any>;
  findUnique: (args: { where: any; include?: any }) => Promise<any>;
  findMany: (args: { where?: any; include?: any; orderBy?: any }) => Promise<any[]>;
  update: (args: { where: any; data: any }) => Promise<any>;
  delete: (args: { where: any }) => Promise<any>;
};

// Similar delegates for Page, Element, BoardMember, ShareLink

export interface PrismaBoardAdapterConfig {
  board: PrismaBoardDelegate;
  page: PrismaPageDelegate;
  element: PrismaElementDelegate;
  boardMember: PrismaBoardMemberDelegate;
  shareLink: PrismaShareLinkDelegate;
}

export class PrismaBoardAdapter extends BoardStorage {
  constructor(private readonly prisma: PrismaBoardAdapterConfig) {
    super();
  }
  // Implement all abstract methods
}
```

Host app usage:
```typescript
new PrismaBoardAdapter({
  board: prisma.board,
  page: prisma.page,
  element: prisma.element,
  boardMember: prisma.boardMember,
  shareLink: prisma.shareLink,
})
```

**Instructions — `prisma-event-log.adapter.ts`:**
Same pattern. Delegates for `BoardEvent` and `BoardSnapshot` models.

**Acceptance:** Adapter compiles. Correctly maps all abstract methods to Prisma delegate calls.

---

### Task 3.2 — Asset Storage Adapters

**Package:** `packages/nestjs`
**Depends on:** 0.5
**Files to create:**

```
packages/nestjs/src/adapters/
├── s3-asset.adapter.ts
└── local-asset.adapter.ts
```

**Instructions — `s3-asset.adapter.ts`:**
Uses the AWS SDK's structural typing pattern (not importing `@aws-sdk/client-s3` directly — make it a peerDependency or accept a pre-configured client):

```typescript
interface S3Client {
  send(command: any): Promise<any>;
}

interface S3AssetAdapterConfig {
  client: S3Client;
  bucket: string;
  prefix?: string;
  cdnUrl?: string;
}
```

**Instructions — `local-asset.adapter.ts`:**
Stores files on local disk. Accepts a `basePath` config. Returns file:// URLs or serves via a configurable base URL. Intended for dev/testing only.

**Acceptance:** Both adapters compile and implement `AssetStorage` fully.

---

### Task 3.3 — Domain Services

**Package:** `packages/nestjs`
**Depends on:** 0.5
**Files to create:**

```
packages/nestjs/src/domain/
├── board.service.ts
├── permission.service.ts
├── asset.service.ts
└── export.service.ts
```

**Instructions — `board.service.ts`:**
```typescript
@Injectable()
export class BoardService {
  constructor(
    private readonly storage: BoardStorage,
    private readonly eventLog: EventLogStorage,
  ) {}

  async createBoard(data: CreateBoardInput): Promise<Board>;
  async getBoard(id: string): Promise<Board>;
  async listBoards(userId: string): Promise<Board[]>;
  async updateBoard(id: string, data: Partial<Board>): Promise<Board>;
  async archiveBoard(id: string): Promise<void>;
  async deleteBoard(id: string): Promise<void>;

  // Page management
  async addPage(boardId: string, data?: CreatePageInput): Promise<Page>;
  async getPages(boardId: string): Promise<Page[]>;
  async reorderPages(boardId: string, pageIds: string[]): Promise<void>;
  async deletePage(pageId: string): Promise<void>;

  // Element loading (for initial board load)
  async getPageElements(pageId: string): Promise<Element[]>;
}
```

All mutations should also append to the event log.

**Instructions — `permission.service.ts`:**
```typescript
@Injectable()
export class PermissionService {
  constructor(private readonly storage: BoardStorage) {}

  async checkAccess(boardId: string, userId: string, requiredRole: string): Promise<boolean>;
  async addMember(boardId: string, userId: string, role: string): Promise<void>;
  async removeMember(boardId: string, userId: string): Promise<void>;
  async resolveShareLink(token: string): Promise<{ boardId: string; permission: string } | null>;
  async createShareLink(boardId: string, permission: string, expiresAt?: string): Promise<ShareLink>;
}
```

**Instructions — `asset.service.ts`:**
Upload validation (file type, size limits), storage delegation, CDN URL generation.

**Instructions — `export.service.ts`:**
Stub for now. Will implement server-side PNG/PDF generation in Sprint 7–8. Define the interface:
```typescript
export type ExportFormat = 'png' | 'pdf' | 'svg';

@Injectable()
export class ExportService {
  async exportBoard(boardId: string, format: ExportFormat, pageIds?: string[]): Promise<Buffer>;
}
```

**Acceptance:** Services compile and inject correctly. Write integration tests using in-memory adapters.

---

### Task 3.4 — DTOs and Validation

**Package:** `packages/nestjs`
**Depends on:** 3.3
**Files to create:**

```
packages/nestjs/src/dto/
├── create-board.dto.ts
├── update-board.dto.ts
├── create-page.dto.ts
├── share-link.dto.ts
├── element-mutation.dto.ts
└── export-request.dto.ts
```

**Instructions:**
Use NestJS class-validator decorators for all DTOs. Each DTO validates the shape of incoming REST requests.

**Acceptance:** DTOs compile. Validators reject invalid input.

---

### Task 3.5 — BoardModule DynamicModule

**Package:** `packages/nestjs`
**Depends on:** 3.3, 0.5
**Files to create:**

```
packages/nestjs/src/module.ts
```

**Instructions:**

Implement the full `BoardModule.register()` with all config options from the final plan:

```typescript
export interface BoardModuleOptions {
  // Required
  storage: BoardStorage;
  assetStorage: AssetStorage;
  eventLogStorage: EventLogStorage;
  authGuard: BoardAuthGuard;

  // Optional — realtime transport override
  realtimeTransport?: RealtimeTransport;

  // Optional — limits
  limits?: Partial<{
    maxElementsPerPage: number;
    maxPagesPerBoard: number;
    maxAssetSizeMb: number;
    maxBoardSizeMb: number;
  }>;

  // Optional — sync tuning
  sync?: Partial<{
    batchPersistIntervalMs: number;
    presenceTtlMs: number;
    reconnectWindowMs: number;
    maxMessageRatePerUser: number;
  }>;

  // Optional — deployment mode
  deployment?: {
    mode: 'self-hosted' | 'managed';
    syncServiceUrl?: string;
  };
}

@Module({})
export class BoardModule {
  static register(options: BoardModuleOptions): DynamicModule {
    // Wire up all providers, exports, controllers
  }
}
```

Provide all storage interfaces as injection tokens. Export all domain services.

**Acceptance:** Module compiles. Can be registered in a NestJS app with in-memory adapters and mock auth guard.

---

### Task 4.1 — REST Controllers (Stub)

**Package:** `packages/nestjs`
**Depends on:** 3.5
**Files to create:**

```
packages/nestjs/src/controllers/
├── board.controller.ts
├── page.controller.ts
├── asset.controller.ts
└── export.controller.ts
```

**Instructions:**
Standard NestJS REST controllers that delegate to domain services. These are optional exports — the host app can use the services directly if it prefers. Key endpoints:

- `POST /boards` — create board
- `GET /boards` — list boards (filtered by user)
- `GET /boards/:id` — get board with pages
- `PATCH /boards/:id` — update board
- `DELETE /boards/:id` — archive board
- `POST /boards/:id/pages` — add page
- `GET /boards/:id/pages/:pageId/elements` — get elements
- `POST /boards/:id/assets` — upload asset
- `POST /boards/:id/export` — trigger export
- `POST /boards/:id/share` — create share link

**Acceptance:** Controllers compile. Routes are discoverable via NestJS.

---

## Sprint 5–6 — Collaboration

**Goal:** Real-time multi-user editing works. WebSocket sync, presence, cursors, reconnection, batch persistence.

---

### Task 5.1 — Collaboration Service

**Package:** `packages/nestjs`
**Depends on:** 3.3
**Files to create:**

```
packages/nestjs/src/domain/
└── collaboration.service.ts
```

**Instructions:**

This is the central orchestrator for live sessions. It:
- Manages in-memory session state per board
- Buffers incoming mutations
- Broadcasts mutations to other clients
- Flushes to DB periodically (batch persistence)
- Handles reconnection (delta sync vs. full sync)

```typescript
@Injectable()
export class CollaborationService {
  private sessions: Map<string, BoardSession>;

  async joinSession(boardId: string, userId: string, lastSequence?: number): Promise<JoinResult>;
  async leaveSession(boardId: string, userId: string): Promise<void>;
  async applyMutations(boardId: string, userId: string, mutations: ElementMutation[]): Promise<number>;
  async getSessionState(boardId: string): Promise<BoardSession | null>;
  
  // Called by timer
  async flushPending(boardId: string): Promise<void>;
  // Called when last user leaves
  async closeSession(boardId: string): Promise<void>;
}

interface BoardSession {
  boardId: string;
  participants: Map<string, Participant>;
  pendingMutations: ElementMutation[];
  currentSequence: number;
  lastFlush: number;
}
```

**Acceptance:** Unit tests with in-memory adapters. Multiple simulated users can join, mutate, and leave. Batch flush writes to storage correctly.

---

### Task 5.2 — WebSocket Gateway

**Package:** `packages/nestjs`
**Depends on:** 5.1
**Files to create:**

```
packages/nestjs/src/realtime/
├── board.gateway.ts
├── presence.manager.ts
├── sync-relay.ts
└── reconnection.handler.ts
```

**Instructions — `board.gateway.ts`:**
NestJS WebSocket gateway using Socket.IO (the default NestJS WS adapter). Handles all protocol messages defined in `@boardkit/core`:

```typescript
@WebSocketGateway({ namespace: '/board' })
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly authGuard: BoardAuthGuard,
    private readonly presence: PresenceManager,
    private readonly syncRelay: SyncRelay,
    private readonly reconnection: ReconnectionHandler,
  ) {}

  async handleConnection(client: Socket): Promise<void>;
  async handleDisconnect(client: Socket): Promise<void>;

  @SubscribeMessage('join')
  async handleJoin(client: Socket, payload: JoinMessage): Promise<void>;

  @SubscribeMessage('mutate')
  async handleMutate(client: Socket, payload: MutateMessage): Promise<void>;

  @SubscribeMessage('cursor')
  async handleCursor(client: Socket, payload: CursorMessage): Promise<void>;

  // ... other message handlers
}
```

If `BoardModuleOptions.realtimeTransport` is provided, skip registering this gateway and use the custom transport instead.

**Instructions — `presence.manager.ts`:**
In-memory presence tracking. Tracks per-board participant list, cursor positions, viewport bounds. Ephemeral — never persisted to DB. Prunes idle participants after `presenceTtlMs`.

**Instructions — `sync-relay.ts`:**
Receives mutations from CollaborationService, broadcasts to all connected clients on the same board (excluding the sender). Also handles ACK messages back to the sender.

**Instructions — `reconnection.handler.ts`:**
Implements the reconnection protocol:
1. Client sends `lastSequence` on reconnect
2. Handler checks if events since that sequence are still in memory
3. If yes → send `sync:delta` with missed events
4. If no → send `sync:full` with current board state

**Acceptance:** Two browser tabs can collaborate on the same board. Cursors are visible across tabs. Mutations sync in real-time. Reconnection works after brief disconnects.

---

### Task 5.3 — Rate Limiting + Size Guards

**Package:** `packages/nestjs`
**Depends on:** 5.2
**Files to create:**

```
packages/nestjs/src/middleware/
├── rate-limiter.middleware.ts
└── size-guard.middleware.ts
```

**Instructions — `rate-limiter.middleware.ts`:**
Token bucket per user per board. Default: 120 messages/sec. When exceeded, send `{ type: 'rate-limited', retryAfterMs }` and drop the message.

**Instructions — `size-guard.middleware.ts`:**
Reject mutations that would exceed board limits (element count, page count). Check against `BoardModuleOptions.limits`.

**Acceptance:** Flooding a WebSocket with messages triggers rate limiting. Adding the 10,001st element to a page is rejected.

---

### Task 6.1 — Frontend Collaboration Hooks

**Package:** `packages/react`
**Depends on:** 2.4
**Files to create:**

```
packages/react/src/hooks/
├── useCollaboration.ts
├── usePresence.ts
└── useExport.ts
```

**Instructions — `useCollaboration.ts`:**
Manages the WebSocket connection lifecycle:
- Connect on mount, disconnect on unmount
- Send local mutations to server
- Receive remote mutations and apply to store
- Handle reconnection with exponential backoff + jitter
- Track connection state: `connecting | connected | reconnecting | disconnected`

**Instructions — `usePresence.ts`:**
- Subscribe to presence events from the WebSocket
- Expose `{ participants, cursors }`
- Send local cursor position updates (throttled to ~30fps)

**Instructions — `useExport.ts`:**
- Client-side: use `canvas.toDataURL()` for PNG export
- Server-side: POST to export endpoint for PDF
- `{ exportPng, exportPdf, isExporting }`

**Acceptance:** Multi-user collaboration works end-to-end.

---

### Task 6.2 — Collaboration UI Components

**Package:** `packages/react`
**Depends on:** 6.1
**Files to create:**

```
packages/react/src/components/
├── ParticipantList.tsx
├── CursorOverlay.tsx
├── ShareDialog.tsx
└── ExportDialog.tsx
```

**Instructions:**
- `ParticipantList` — shows online users with assigned colors, avatar initials
- `CursorOverlay` — renders remote cursors on the interactive canvas layer with name labels
- `ShareDialog` — UI for creating/managing share links, accepts `className`
- `ExportDialog` — format selection (PNG/PDF), page selection, quality options

All components accept `className` prop. No hardcoded CSS.

**Acceptance:** Full collaboration UI works. Remote cursors visible. Share links functional.

---

## Sprint 7–8 — Polish P0

**Goal:** Permissions enforced, export working, session lifecycle managed, keyboard shortcuts, error recovery.

---

### Task 7.1 — Permission Enforcement

Wire `PermissionService` into gateway and controllers. Viewers can't mutate. Editors can't change permissions. Only owners can delete boards.

### Task 7.2 — Session Lifecycle

Implement state machine: `created → active → idle → archived`. Ephemeral boards auto-delete after idle timeout. Persistent boards auto-snapshot on idle.

### Task 7.3 — Export Implementation

Implement server-side PNG/PDF export using canvas rendering in Node (e.g., `canvas` npm package) or a headless browser approach.

### Task 7.4 — Keyboard Shortcuts

Bind all standard shortcuts in `useKeyboardShortcuts`:
- `Ctrl+Z` / `Ctrl+Y` — undo/redo
- `Delete` / `Backspace` — delete selected
- `Ctrl+C` / `Ctrl+V` — copy/paste
- `Ctrl+A` — select all
- `Ctrl+D` — duplicate
- `Ctrl+G` — group
- `1-6` — tool switching
- `Space+drag` — pan
- `Ctrl+0` — reset zoom
- `Ctrl+Shift+F` — fit to content

### Task 7.5 — Error Recovery

Handle edge cases:
- Concurrent page deletion while someone is drawing
- Asset upload failure mid-way (show error state on element)
- Board corruption recovery from event log
- Stale tab detection via session IDs

---

## Sprint 9–10 — P1 Features

### Task 9.1 — Sticky Notes
### Task 9.2 — Connectors
### Task 9.3 — Laser Pointer + Highlighter
### Task 9.4 — Image/PDF Import
### Task 9.5 — Grid + Snap + Alignment Guides
### Task 9.6 — Follow Mode
### Task 9.7 — Minimap

(Each of these follows the same pattern: add type to core, add tool/operation logic to core, add renderer to react, add any backend support to nestjs.)

---

## Appendix A — Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Monorepo root | `boardkit-monorepo` | — |
| Core package | `@boardkit/core` | — |
| Backend package | `@boardkit/nestjs` | — |
| Frontend package | `@boardkit/react` | — |
| Storage interfaces | `{Name}Storage` | `BoardStorage`, `AssetStorage` |
| Prisma adapters | `Prisma{Name}Adapter` | `PrismaBoardAdapter` |
| NestJS module | `BoardModule` | — |
| Domain services | `{Name}Service` | `BoardService`, `CollaborationService` |
| React provider | `BoardKitProvider` | — |
| React hooks | `use{Name}` | `useBoard`, `useCollaboration` |
| Tool classes | `{Name}Tool` | `PenTool`, `SelectTool` |
| Core types | PascalCase interfaces | `Board`, `Element`, `StrokeElement` |

## Appendix B — Prisma Schema Reference

(Include the full schema from `boardkit-final-plan.md` — Board, Page, Element, BoardMember, ShareLink, Asset, BoardEvent, BoardSnapshot.)

## Appendix C — Claude Code Session Tips

When working on this project in Claude Code:

1. **Always start a session by reading this plan** — check which sprint/task you're on
2. **Build after every task** — `npx turbo build` to catch type errors early
3. **Core first** — if a task spans packages, implement the core types/logic first, then nestjs, then react
4. **Test with fixtures** — use `createSimpleBoard()` for quick integration checks
5. **One task per session** — each task is scoped to be completable in one focused session
6. **Barrel exports matter** — after creating new files, always update the nearest `index.ts`
7. **No `@prisma/client` imports** — if you find yourself reaching for it, stop and use structural typing
8. **Canvas state outside React** — if you're putting canvas state in `useState`, you're doing it wrong
