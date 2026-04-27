import { RectShapeTool } from './rect-shape-tool.base';

export class RectangleTool extends RectShapeTool {
    readonly id = 'rectangle';
    readonly name = 'Rectangle';
    readonly shapeType = 'rectangle' as const;
}
