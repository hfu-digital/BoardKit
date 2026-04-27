import { RectShapeTool } from './rect-shape-tool.base';

export class DiamondTool extends RectShapeTool {
    readonly id = 'diamond';
    readonly name = 'Diamond';
    readonly shapeType = 'diamond' as const;
}
