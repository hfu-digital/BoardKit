# @hfu.digital/boardkit-core

Zero-dependency shared kernel for [BoardKit](../../README.md). Contains types, scene graph, drawing tools, collaboration protocol, and validation — all in pure TypeScript with no runtime dependencies.

## Installation

```bash
bun add @hfu.digital/boardkit-core
```

## What's Included

### Types

The `Element` discriminated union covers all whiteboard element types:

```typescript
import type { Element, StrokeElement, ShapeElement, TextElement } from '@hfu.digital/boardkit-core';
import type { Board, Page, Participant } from '@hfu.digital/boardkit-core';
import type { ClientMessage, ServerMessage } from '@hfu.digital/boardkit-core';
```

### Scene Graph

Immutable state container for elements:

```typescript
import { createScene, addElement, removeElement, updateElement, getElementsByPage } from '@hfu.digital/boardkit-core';

let scene = createScene();
scene = addElement(scene, myElement);
scene = updateElement(scene, 'el-1', { zIndex: 10 });
const pageElements = getElementsByPage(scene, 'page-1');
```

### Tools

Abstract `Tool` class with state machine (`idle → active → finishing → idle`). Nine tools available via `ToolRegistry`:

```typescript
import { ToolRegistry, TOOL_IDS } from '@hfu.digital/boardkit-core';

const registry = ToolRegistry.createDefault();
const pen = registry.get(TOOL_IDS.PEN);
```

| Tool | TOOL_IDS | Creates |
|------|----------|---------|
| PenTool | `PEN` | StrokeElement |
| ShapeTool | `SHAPE` | ShapeElement |
| TextTool | `TEXT` | TextElement |
| StickyNoteTool | `STICKY_NOTE` | StickyNoteElement |
| ConnectorTool | `CONNECTOR` | ConnectorElement |
| SelectTool | `SELECT` | — (selection/drag) |
| EraserTool | `ERASER` | — (delete mutations) |
| LaserTool | `LASER` | — (preview only) |
| HandTool | `HAND` | — (viewport pan) |

### Operations

- **LWW Merge**: `mergeElement()` / `mergeScene()` for conflict resolution (remote wins on tie)
- **History**: Undo/redo stack with configurable max depth
- **Clipboard**: Serialize/deserialize selections with relative positioning
- **Transforms**: Move, resize, rotate elements

### Drawing Algorithms

- **Smoothing**: Catmull-Rom spline interpolation
- **Simplification**: Ramer-Douglas-Peucker algorithm
- **Pressure**: Pen pressure to stroke width mapping

### Validation

```typescript
import { validateElement, validateBoardLimits, validateAssetSize } from '@hfu.digital/boardkit-core';

const result = validateElement(untrustedData);
if (!result.valid) console.error(result.errors);
```

## License

[MIT](../../LICENSE)
