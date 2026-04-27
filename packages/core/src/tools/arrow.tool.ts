import { LinearTool } from './linear-tool.base';

export class ArrowTool extends LinearTool {
    readonly id = 'arrow';
    readonly name = 'Arrow';
    readonly linearType = 'arrow' as const;
    readonly arrowEnd = true;
}
