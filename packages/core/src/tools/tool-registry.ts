import { Tool } from './tool.interface';
import { PenTool } from './pen.tool';
import { ShapeTool } from './shape.tool';
import { SelectTool } from './select.tool';
import { EraserTool } from './eraser.tool';
import { TextTool } from './text.tool';
import { StickyNoteTool } from './sticky-note.tool';
import { ConnectorTool } from './connector.tool';
import { LaserTool } from './laser.tool';

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.id, tool);
    }

    get(id: string): Tool | undefined {
        return this.tools.get(id);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    static createDefault(): ToolRegistry {
        const registry = new ToolRegistry();
        registry.register(new PenTool());
        registry.register(new ShapeTool());
        registry.register(new SelectTool());
        registry.register(new EraserTool());
        registry.register(new TextTool());
        registry.register(new StickyNoteTool());
        registry.register(new ConnectorTool());
        registry.register(new LaserTool());
        return registry;
    }
}
