import { RectShapeTool } from './rect-shape-tool.base';

export class EllipseTool extends RectShapeTool {
    readonly id = 'ellipse';
    readonly name = 'Ellipse';
    readonly shapeType = 'ellipse' as const;
}
