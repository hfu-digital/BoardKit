import React from 'react';
import { TOOL_IDS } from '@hfu.digital/boardkit-core';
import {
    MousePointer2,
    Square,
    Diamond,
    Circle,
    ArrowRight,
    Minus,
    Pencil,
    Type,
    Image as ImageIcon,
    Eraser,
    Hand,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { Tooltip } from './Tooltip';

export interface ToolbarProps {
    className?: string;
}

interface ToolDef {
    id: (typeof TOOL_IDS)[keyof typeof TOOL_IDS];
    label: string;
    shortcut: string;
    Icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
    { id: TOOL_IDS.SELECT, label: 'Select', shortcut: 'V', Icon: MousePointer2 },
    { id: TOOL_IDS.RECTANGLE, label: 'Rectangle', shortcut: 'R', Icon: Square },
    { id: TOOL_IDS.DIAMOND, label: 'Diamond', shortcut: 'D', Icon: Diamond },
    { id: TOOL_IDS.ELLIPSE, label: 'Ellipse', shortcut: 'O', Icon: Circle },
    { id: TOOL_IDS.ARROW, label: 'Arrow', shortcut: 'A', Icon: ArrowRight },
    { id: TOOL_IDS.LINE, label: 'Line', shortcut: 'L', Icon: Minus },
    { id: TOOL_IDS.PEN, label: 'Pen', shortcut: 'P', Icon: Pencil },
    { id: TOOL_IDS.TEXT, label: 'Text', shortcut: 'T', Icon: Type },
    { id: TOOL_IDS.IMAGE, label: 'Image', shortcut: 'I', Icon: ImageIcon },
    { id: TOOL_IDS.ERASER, label: 'Eraser', shortcut: 'E', Icon: Eraser },
    { id: TOOL_IDS.HAND, label: 'Hand', shortcut: 'H', Icon: Hand },
    { id: TOOL_IDS.LASER, label: 'Laser', shortcut: 'K', Icon: Sparkles },
];

/**
 * Excalidraw-style floating toolbar. The pill bar is rendered with
 * `.bk-pill` and each button uses `.bk-icon-btn` so visuals come from CSS
 * tokens (no inline styles for theming). Consumers position the bar with
 * their own absolute/fixed wrapper — we don't take a stance on layout.
 */
export function Toolbar({ className }: ToolbarProps) {
    const { activeTool, setTool } = useTool();

    return (
        <div
            className={`bk-pill ${className ?? ''}`.trim()}
            role="toolbar"
            aria-label="Drawing tools"
        >
            {TOOLS.map((tool, idx) => {
                // A divider between selection (Select) and the drawing tools, then
                // before utility tools (Hand / Laser) — matches Excalidraw's
                // visual grouping.
                const showDivider = idx === 1 || idx === 10;
                const { Icon } = tool;
                return (
                    <React.Fragment key={tool.id}>
                        {showDivider && <span className="bk-divider" aria-hidden="true" />}
                        <Tooltip label={tool.label} shortcut={tool.shortcut} side="top">
                            <button
                                type="button"
                                className="bk-icon-btn"
                                onClick={() => setTool(tool.id)}
                                aria-pressed={activeTool === tool.id}
                                aria-label={`${tool.label} (${tool.shortcut})`}
                            >
                                <Icon aria-hidden="true" />
                                <span className="bk-sr-only">{tool.label}</span>
                            </button>
                        </Tooltip>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
