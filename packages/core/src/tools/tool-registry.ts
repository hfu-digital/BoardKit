import { Tool } from './tool.interface';
import { PenTool } from './pen.tool';
import { SelectTool } from './select.tool';
import { EraserTool } from './eraser.tool';
import { TextTool } from './text.tool';
import { LaserTool } from './laser.tool';
import { RectangleTool } from './rectangle.tool';
import { DiamondTool } from './diamond.tool';
import { EllipseTool } from './ellipse.tool';
import { LineTool } from './line.tool';
import { ArrowTool } from './arrow.tool';
import { ImageTool } from './image.tool';

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

    /**
     * Default registry mirrors Excalidraw's tool order. The HAND tool isn't
     * registered as a Tool subclass — viewport panning is handled by the input
     * pipeline (space + drag), but the toolbar still shows a Hand button that
     * routes to the Select tool with a panning modifier.
     */
    static createDefault(): ToolRegistry {
        const registry = new ToolRegistry();
        registry.register(new SelectTool());
        registry.register(new RectangleTool());
        registry.register(new DiamondTool());
        registry.register(new EllipseTool());
        registry.register(new ArrowTool());
        registry.register(new LineTool());
        registry.register(new PenTool());
        registry.register(new TextTool());
        registry.register(new ImageTool());
        registry.register(new EraserTool());
        registry.register(new LaserTool());
        return registry;
    }
}
