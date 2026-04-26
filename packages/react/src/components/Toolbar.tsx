import React from 'react';
import { TOOL_IDS } from '@hfu.digital/boardkit-core';
import { useTool } from '../hooks/useTool';

export interface ToolbarProps {
    className?: string;
}

type IconProps = { className?: string };

const iconProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
};

function SelectIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M3 3l7.07 17 2.51-7.39L20 10.07z" />
        </svg>
    );
}

function PenIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            <path d="m15 5 4 4" />
        </svg>
    );
}

function ShapeIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
    );
}

function TextIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M4 7V5h16v2" />
            <path d="M9 20h6" />
            <path d="M12 5v15" />
        </svg>
    );
}

function EraserIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
            <path d="m5.082 11.09 8.828 8.828" />
        </svg>
    );
}

function HandIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10V4a2 2 0 0 0-4 0v6" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
    );
}

function StickyNoteIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z" />
            <path d="M16 3v5a2 2 0 0 0 2 2h3" />
        </svg>
    );
}

function ConnectorIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="5" r="2" />
            <path d="M6.5 17.5 17 7" />
        </svg>
    );
}

function LaserIcon({ className }: IconProps) {
    return (
        <svg {...iconProps} className={className}>
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        </svg>
    );
}

const TOOLS: Array<{
    id: (typeof TOOL_IDS)[keyof typeof TOOL_IDS];
    label: string;
    shortcut: string;
    Icon: (props: IconProps) => React.JSX.Element;
}> = [
    { id: TOOL_IDS.SELECT, label: 'Select', shortcut: '1', Icon: SelectIcon },
    { id: TOOL_IDS.PEN, label: 'Pen', shortcut: '2', Icon: PenIcon },
    { id: TOOL_IDS.SHAPE, label: 'Shape', shortcut: '3', Icon: ShapeIcon },
    { id: TOOL_IDS.TEXT, label: 'Text', shortcut: '4', Icon: TextIcon },
    { id: TOOL_IDS.ERASER, label: 'Eraser', shortcut: '5', Icon: EraserIcon },
    { id: TOOL_IDS.HAND, label: 'Hand', shortcut: '6', Icon: HandIcon },
    { id: TOOL_IDS.STICKY_NOTE, label: 'Sticky Note', shortcut: '7', Icon: StickyNoteIcon },
    { id: TOOL_IDS.CONNECTOR, label: 'Connector', shortcut: '8', Icon: ConnectorIcon },
    { id: TOOL_IDS.LASER, label: 'Laser', shortcut: '9', Icon: LaserIcon },
];

export function Toolbar({ className }: ToolbarProps) {
    const { activeTool, setTool } = useTool();

    return (
        <div className={className} role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((tool) => {
                const { Icon } = tool;
                return (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={() => setTool(tool.id)}
                        aria-pressed={activeTool === tool.id}
                        aria-label={tool.label}
                        title={`${tool.label} (${tool.shortcut})`}
                    >
                        <Icon />
                        <span
                            style={{
                                position: 'absolute',
                                width: 1,
                                height: 1,
                                padding: 0,
                                margin: -1,
                                overflow: 'hidden',
                                clip: 'rect(0, 0, 0, 0)',
                                whiteSpace: 'nowrap',
                                border: 0,
                            }}
                        >
                            {tool.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
