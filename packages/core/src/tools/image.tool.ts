import type { SceneState } from '../scene/scene-graph';
import { Tool, type InputEvent, type ToolResult, type ToolState } from './tool.interface';

/**
 * Stub for the Image tool. Pointer interactions on the canvas don't draw
 * anything — image insertion happens through `useImageImport` (drag-drop /
 * paste / file picker) wired up in the React layer in M5. The tool exists
 * here so the toolbar has a button + shortcut and the registry sees `image`.
 *
 * Selecting this tool sets cursor to a 'copy' style hint so users understand
 * they should drop or paste a file.
 */
export class ImageTool extends Tool {
    readonly id = 'image';
    readonly name = 'Image';
    state: ToolState = 'idle';

    onPointerDown(_event: InputEvent, _scene: SceneState): ToolResult {
        return { state: 'idle', cursor: 'copy' };
    }

    onPointerMove(_event: InputEvent, _scene: SceneState): ToolResult {
        return { state: 'idle', cursor: 'copy' };
    }

    onPointerUp(_event: InputEvent, _scene: SceneState): ToolResult {
        return { state: 'idle', cursor: 'copy' };
    }

    onCancel(): ToolResult {
        return { state: 'idle' };
    }
}
