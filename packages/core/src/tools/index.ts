export { Tool } from './tool.interface';
export type { InputEvent, ToolState, ToolResult } from './tool.interface';
export { PenTool } from './pen.tool';
export { SelectTool } from './select.tool';
export { EraserTool } from './eraser.tool';
export { TextTool } from './text.tool';
export type { TextToolEvent } from './text.tool';
export { LaserTool } from './laser.tool';

// Excalidraw-aligned shape & linear tools (replaces the old generic ShapeTool +
// StickyNoteTool + ConnectorTool).
export { RectShapeTool } from './rect-shape-tool.base';
export { RectangleTool } from './rectangle.tool';
export { DiamondTool } from './diamond.tool';
export { EllipseTool } from './ellipse.tool';
export { LinearTool } from './linear-tool.base';
export { LineTool } from './line.tool';
export { ArrowTool } from './arrow.tool';
export { ImageTool } from './image.tool';

export { ToolRegistry } from './tool-registry';
