import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { TOOL_IDS } from '../../src/constants';

describe('ToolRegistry', () => {
    it('createDefault registers 11 tools (Hand panning is handled in the input pipeline)', () => {
        const registry = ToolRegistry.createDefault();
        expect(registry.getAll().length).toBe(11);
    });

    it('can retrieve each Excalidraw-aligned tool by id', () => {
        const registry = ToolRegistry.createDefault();
        const expectedIds = [
            TOOL_IDS.SELECT,
            TOOL_IDS.RECTANGLE,
            TOOL_IDS.DIAMOND,
            TOOL_IDS.ELLIPSE,
            TOOL_IDS.ARROW,
            TOOL_IDS.LINE,
            TOOL_IDS.PEN,
            TOOL_IDS.TEXT,
            TOOL_IDS.IMAGE,
            TOOL_IDS.ERASER,
            TOOL_IDS.LASER,
        ];
        for (const id of expectedIds) {
            expect(registry.get(id)).toBeDefined();
            expect(registry.get(id)!.id).toBe(id);
        }
    });

    it('returns undefined for unregistered tool', () => {
        const registry = new ToolRegistry();
        expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites tool with same id', () => {
        const registry = ToolRegistry.createDefault();
        const penBefore = registry.get(TOOL_IDS.PEN)!;
        const fakeTool = { ...penBefore, name: 'FakePen' };
        registry.register(fakeTool as any);
        expect(registry.get(TOOL_IDS.PEN)!.name).toBe('FakePen');
        expect(registry.getAll().length).toBe(11);
    });
});
