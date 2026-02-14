import React from 'react';
import { TOOL_IDS } from '@boardkit/core';
import { useTool } from '../hooks/useTool';

export interface ToolbarProps {
    className?: string;
}

const TOOLS = [
    { id: TOOL_IDS.SELECT, label: 'Select', shortcut: '1' },
    { id: TOOL_IDS.PEN, label: 'Pen', shortcut: '2' },
    { id: TOOL_IDS.SHAPE, label: 'Shape', shortcut: '3' },
    { id: TOOL_IDS.TEXT, label: 'Text', shortcut: '4' },
    { id: TOOL_IDS.ERASER, label: 'Eraser', shortcut: '5' },
    { id: TOOL_IDS.HAND, label: 'Hand', shortcut: '6' },
    { id: TOOL_IDS.STICKY_NOTE, label: 'Sticky Note', shortcut: '7' },
    { id: TOOL_IDS.CONNECTOR, label: 'Connector', shortcut: '8' },
    { id: TOOL_IDS.LASER, label: 'Laser', shortcut: '9' },
];

export function Toolbar({ className }: ToolbarProps) {
    const { activeTool, setTool } = useTool();

    return (
        <div className={className} role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => setTool(tool.id)}
                    aria-pressed={activeTool === tool.id}
                    title={`${tool.label} (${tool.shortcut})`}
                >
                    {tool.label}
                </button>
            ))}
        </div>
    );
}
