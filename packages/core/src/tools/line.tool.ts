import { LinearTool } from './linear-tool.base';

export class LineTool extends LinearTool {
    readonly id = 'line';
    readonly name = 'Line';
    readonly linearType = 'line' as const;
    readonly arrowEnd = false;
}
