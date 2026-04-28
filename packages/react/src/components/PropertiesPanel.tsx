import React, { useState } from 'react';
import type {
    Element,
    ShapeElement,
    LinearElement,
    TextElement,
    StrokeElement,
    StrokeStyle,
    FillStyle,
} from '@hfu.digital/boardkit-core';
import {
    ArrowUpToLine,
    ArrowDownToLine,
    ChevronUp,
    ChevronDown,
    Copy,
    Trash2,
    Lock,
    Unlock,
} from 'lucide-react';
import { useSelection } from '../hooks/useSelection';
import { useElementMutations } from '../hooks/useElementMutations';
import { measureText } from '../hooks/useTextEditor';
import { DEFAULT_TEXT_STYLE } from '@hfu.digital/boardkit-core';
import { EXCALIDRAW_PALETTE } from '../styles/excalidraw-palette';
import { Tooltip } from './Tooltip';
import { HFU_PALETTE } from '../styles/hfu-palette';

export interface PropertiesPanelProps {
    className?: string;
}

type PaletteName = 'excalidraw' | 'hfu';

/**
 * Selection-driven left sidebar. Renders the appropriate control set for
 * the first selected element type. Multi-selection of mixed types shows
 * only the controls common to all (currently: layer + element actions).
 *
 * The panel renders nothing when nothing is selected — the consumer's
 * absolute/fixed wrapper should handle the visibility transition.
 */
export function PropertiesPanel({ className }: PropertiesPanelProps) {
    const { selectedElements } = useSelection();
    const { patchElement, deleteElements, reorderElements, duplicateElements } = useElementMutations();
    const [palette, setPalette] = useState<PaletteName>('excalidraw');

    if (selectedElements.length === 0) return null;

    // For multi-selection of mixed types, only common controls are safe.
    const allShape = selectedElements.every((el): el is ShapeElement => el.type === 'shape');
    const allLinear = selectedElements.every((el): el is LinearElement => el.type === 'linear');
    const allText = selectedElements.every((el): el is TextElement => el.type === 'text');
    const allStroke = selectedElements.every((el): el is StrokeElement => el.type === 'stroke');
    const ids = selectedElements.map((el) => el.id);
    const palDef = palette === 'excalidraw' ? EXCALIDRAW_PALETTE : HFU_PALETTE;

    return (
        <aside className={`bk-properties-panel ${className ?? ''}`.trim()} aria-label="Element properties">
            <PaletteToggle value={palette} onChange={setPalette} />

            {(allShape || allLinear || allStroke) && (
                <ColorSection
                    label="Stroke"
                    colors={palDef.stroke}
                    value={extractStrokeColor(selectedElements[0])}
                    onChange={(color) => {
                        for (const el of selectedElements) {
                            patchElement(el.id, strokeColorPatch(el, color));
                        }
                    }}
                />
            )}

            {allShape && (
                <ColorSection
                    label="Fill"
                    colors={palDef.fill}
                    transparentValue="transparent"
                    value={selectedElements[0].data.style.fill.type === 'none'
                        ? 'transparent'
                        : selectedElements[0].data.style.fill.color}
                    onChange={(color) => {
                        const next: Partial<FillStyle> = color === 'transparent'
                            ? { type: 'none' }
                            : { type: 'solid', color };
                        for (const el of selectedElements) {
                            patchElement(el.id, { style: { fill: next } } as any);
                        }
                    }}
                />
            )}

            {allShape && (
                <SegmentedSection
                    label="Fill style"
                    options={[
                        { value: 'solid', label: 'Solid' },
                        { value: 'hachure', label: 'Hatch' },
                        { value: 'cross-hatch', label: 'Cross' },
                        { value: 'zigzag', label: 'Zigzag' },
                        { value: 'dots', label: 'Dots' },
                    ]}
                    value={selectedElements[0].data.style.fill.type === 'none'
                        ? 'solid'
                        : selectedElements[0].data.style.fill.type}
                    onChange={(v) => {
                        for (const el of selectedElements) {
                            // Only updates fill type — color/opacity untouched.
                            patchElement(el.id, { style: { fill: { type: v as FillStyle['type'] } } } as any);
                        }
                    }}
                />
            )}

            {(allShape || allLinear || allStroke) && (
                <SegmentedSection
                    label="Stroke width"
                    options={[
                        { value: '1', label: 'Thin' },
                        { value: '2', label: 'Med' },
                        { value: '4', label: 'Bold' },
                    ]}
                    value={String(extractStrokeWidth(selectedElements[0]))}
                    onChange={(v) => {
                        const width = Number(v);
                        for (const el of selectedElements) {
                            patchElement(el.id, strokeWidthPatch(el, width));
                        }
                    }}
                />
            )}

            {(allShape || allLinear) && (
                <SegmentedSection
                    label="Stroke style"
                    options={[
                        { value: 'solid', label: '——' },
                        { value: 'dashed', label: '- -' },
                        { value: 'dotted', label: '· ·' },
                    ]}
                    value={extractStrokePattern(selectedElements[0])}
                    onChange={(v) => {
                        const pattern = v as StrokeStyle['pattern'];
                        for (const el of selectedElements) {
                            patchElement(el.id, strokePatternPatch(el, pattern));
                        }
                    }}
                />
            )}

            {(allShape || allLinear) && (
                <SegmentedSection
                    label="Sloppiness"
                    options={[
                        { value: '0', label: 'Architect' },
                        { value: '1', label: 'Artist' },
                        { value: '2', label: 'Cartoonist' },
                    ]}
                    value={String(extractRoughness(selectedElements[0]))}
                    onChange={(v) => {
                        const roughness = Number(v) as 0 | 1 | 2;
                        for (const el of selectedElements) {
                            patchElement(el.id, roughnessPatch(el, roughness));
                        }
                    }}
                />
            )}

            {allShape && selectedElements[0].data.shapeType === 'rectangle' && (
                <SegmentedSection
                    label="Edges"
                    options={[
                        { value: '0', label: 'Sharp' },
                        { value: '8', label: 'Round' },
                    ]}
                    value={selectedElements[0].data.style.cornerRadius > 0 ? '8' : '0'}
                    onChange={(v) => {
                        const cornerRadius = Number(v);
                        for (const el of selectedElements) {
                            patchElement(el.id, { style: { cornerRadius } } as any);
                        }
                    }}
                />
            )}

            {allText && (
                <>
                    <SegmentedSection
                        label="Font"
                        options={[
                            { value: 'Virgil', label: 'Hand' },
                            { value: 'system-ui', label: 'Sans' },
                            { value: 'Cascadia', label: 'Code' },
                        ]}
                        value={extractFontFamily(selectedElements[0])}
                        onChange={(v) => {
                            const fontFamily = v === 'Virgil'
                                ? 'Virgil, Caveat, system-ui, sans-serif'
                                : v === 'Cascadia'
                                    ? 'Cascadia, Cascadia Code, monospace'
                                    : 'system-ui, sans-serif';
                            for (const el of selectedElements) {
                                patchElement(el.id, { style: { fontFamily } } as any);
                            }
                        }}
                    />
                    <SegmentedSection
                        label="Font size"
                        options={[
                            { value: '14', label: 'S' },
                            { value: '20', label: 'M' },
                            { value: '28', label: 'L' },
                            { value: '40', label: 'XL' },
                        ]}
                        value={String(selectedElements[0].data.style.fontSize)}
                        onChange={(v) => {
                            const fontSize = Number(v);
                            for (const el of selectedElements) {
                                if (el.type === 'text') {
                                    // Re-measure size + bounds whenever
                                    // fontSize changes so the selection
                                    // chrome (which reads bounds) stays in
                                    // sync with the rendered text.
                                    const text = el as TextElement;
                                    const nextStyle = { ...DEFAULT_TEXT_STYLE, ...text.data.style, fontSize };
                                    const size = measureText(text.data.content, nextStyle);
                                    patchElement(el.id, {
                                        style: { fontSize },
                                        size,
                                        bounds: {
                                            x: text.data.position.x,
                                            y: text.data.position.y,
                                            width: size.width,
                                            height: size.height,
                                        },
                                    } as any);
                                } else {
                                    patchElement(el.id, { style: { fontSize } } as any);
                                }
                            }
                        }}
                    />
                    <SegmentedSection
                        label="Align"
                        options={[
                            { value: 'left', label: 'L' },
                            { value: 'center', label: 'C' },
                            { value: 'right', label: 'R' },
                        ]}
                        value={selectedElements[0].data.style.textAlign}
                        onChange={(v) => {
                            for (const el of selectedElements) {
                                patchElement(el.id, { style: { textAlign: v as 'left' | 'center' | 'right' } } as any);
                            }
                        }}
                    />
                </>
            )}

            <OpacitySection
                value={extractOpacity(selectedElements[0])}
                onChange={(opacity) => {
                    for (const el of selectedElements) {
                        patchElement(el.id, opacityPatch(el, opacity));
                    }
                }}
            />

            <LayerActions ids={ids} reorder={reorderElements} />
            <ElementActions
                ids={ids}
                onDuplicate={() => duplicateElements(ids)}
                onDelete={() => deleteElements(ids)}
                onToggleLock={() => {
                    for (const el of selectedElements) {
                        patchElement(el.id, ({ /* lockedBy is element-level, not data — shimmed on element */ } as any));
                    }
                }}
                isLocked={Boolean((selectedElements[0] as any).lockedBy)}
            />
        </aside>
    );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function PaletteToggle({ value, onChange }: { value: PaletteName; onChange: (v: PaletteName) => void }) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">Palette</span>
            <div className="bk-palette-toggle" role="group" aria-label="Color palette">
                <button type="button" aria-pressed={value === 'excalidraw'} onClick={() => onChange('excalidraw')}>
                    Excalidraw
                </button>
                <button type="button" aria-pressed={value === 'hfu'} onClick={() => onChange('hfu')}>
                    HFU
                </button>
            </div>
        </div>
    );
}

function ColorSection({
    label,
    colors,
    value,
    onChange,
    transparentValue,
}: {
    label: string;
    colors: readonly string[];
    value: string;
    onChange: (color: string) => void;
    transparentValue?: string;
}) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">{label}</span>
            <div className="bk-swatch-row">
                {colors.map((c) => (
                    <button
                        key={c}
                        type="button"
                        className="bk-swatch"
                        style={c === transparentValue ? undefined : { background: c }}
                        data-selected={c === value || (transparentValue && value === transparentValue && c === transparentValue)}
                        data-transparent={c === transparentValue}
                        aria-label={c}
                        onClick={() => onChange(c)}
                    />
                ))}
            </div>
        </div>
    );
}

function SegmentedSection({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">{label}</span>
            <div className="bk-control-row" role="group" aria-label={label}>
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        className="bk-control-btn"
                        aria-pressed={value === opt.value}
                        data-selected={value === opt.value}
                        onClick={() => onChange(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function OpacitySection({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">Opacity {Math.round(value * 100)}%</span>
            <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value * 100)}
                onChange={(e) => onChange(Number(e.target.value) / 100)}
                className="bk-slider"
                aria-label="Opacity"
            />
        </div>
    );
}

function LayerActions({
    ids,
    reorder,
}: {
    ids: string[];
    reorder: (ids: string[], dir: 'front' | 'back' | 'forward' | 'backward') => void;
}) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">Layers</span>
            <div className="bk-control-row" role="group" aria-label="Layer order">
                <Tooltip label="Send to back" side="top">
                    <button type="button" className="bk-control-btn" aria-label="Send to back" onClick={() => reorder(ids, 'back')}>
                        <ArrowDownToLine size={14} />
                    </button>
                </Tooltip>
                <Tooltip label="Send backward" side="top">
                    <button type="button" className="bk-control-btn" aria-label="Send backward" onClick={() => reorder(ids, 'backward')}>
                        <ChevronDown size={14} />
                    </button>
                </Tooltip>
                <Tooltip label="Bring forward" side="top">
                    <button type="button" className="bk-control-btn" aria-label="Bring forward" onClick={() => reorder(ids, 'forward')}>
                        <ChevronUp size={14} />
                    </button>
                </Tooltip>
                <Tooltip label="Bring to front" side="top">
                    <button type="button" className="bk-control-btn" aria-label="Bring to front" onClick={() => reorder(ids, 'front')}>
                        <ArrowUpToLine size={14} />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
}

function ElementActions({
    ids,
    onDuplicate,
    onDelete,
    onToggleLock,
    isLocked,
}: {
    ids: string[];
    onDuplicate: () => void;
    onDelete: () => void;
    onToggleLock: () => void;
    isLocked: boolean;
}) {
    return (
        <div className="bk-prop-section">
            <span className="bk-prop-label">Actions</span>
            <div className="bk-control-row" role="group" aria-label="Element actions">
                <Tooltip label="Duplicate" shortcut="Ctrl+D" side="top">
                    <button
                        type="button"
                        className="bk-control-btn"
                        aria-label="Duplicate"
                        onClick={onDuplicate}
                        disabled={ids.length === 0}
                    >
                        <Copy size={14} />
                    </button>
                </Tooltip>
                <Tooltip label={isLocked ? 'Unlock' : 'Lock'} side="top">
                    <button
                        type="button"
                        className="bk-control-btn"
                        aria-label={isLocked ? 'Unlock' : 'Lock'}
                        onClick={onToggleLock}
                        disabled={ids.length === 0}
                    >
                        {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                    </button>
                </Tooltip>
                <Tooltip label="Delete" shortcut="Del" side="top">
                    <button
                        type="button"
                        className="bk-control-btn"
                        aria-label="Delete"
                        onClick={onDelete}
                        disabled={ids.length === 0}
                    >
                        <Trash2 size={14} />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
}

// ── Element-shape-aware extractors and patches ───────────────────────────

function extractStrokeColor(el: Element): string {
    if (el.type === 'shape') return el.data.style.stroke.color;
    if (el.type === 'linear') return el.data.style.color;
    if (el.type === 'stroke') return el.data.style.color;
    if (el.type === 'text') return el.data.style.color;
    return '#1b1b1f';
}

function strokeColorPatch(el: Element, color: string): Partial<Element['data']> {
    if (el.type === 'shape') return { style: { stroke: { color } } } as any;
    if (el.type === 'linear') return { style: { color } } as any;
    if (el.type === 'stroke') return { style: { color } } as any;
    if (el.type === 'text') return { style: { color } } as any;
    return {} as any;
}

function extractStrokeWidth(el: Element): number {
    if (el.type === 'shape') return el.data.style.stroke.width;
    if (el.type === 'linear' || el.type === 'stroke') return el.data.style.width;
    return 2;
}

function strokeWidthPatch(el: Element, width: number): Partial<Element['data']> {
    if (el.type === 'shape') return { style: { stroke: { width } } } as any;
    if (el.type === 'linear' || el.type === 'stroke') return { style: { width } } as any;
    return {} as any;
}

function extractStrokePattern(el: Element): StrokeStyle['pattern'] {
    if (el.type === 'shape') return el.data.style.stroke.pattern;
    if (el.type === 'linear') return el.data.style.pattern;
    return 'solid';
}

function strokePatternPatch(el: Element, pattern: StrokeStyle['pattern']): Partial<Element['data']> {
    if (el.type === 'shape') return { style: { stroke: { pattern } } } as any;
    if (el.type === 'linear') return { style: { pattern } } as any;
    return {} as any;
}

function extractRoughness(el: Element): 0 | 1 | 2 {
    if (el.type === 'shape') return el.data.style.roughness;
    if (el.type === 'linear') return el.data.roughness;
    return 1;
}

function roughnessPatch(el: Element, roughness: 0 | 1 | 2): Partial<Element['data']> {
    if (el.type === 'shape') return { style: { roughness } } as any;
    if (el.type === 'linear') return { roughness } as any;
    return {} as any;
}

function extractOpacity(el: Element): number {
    if (el.type === 'shape') return el.data.style.stroke.opacity;
    if (el.type === 'linear' || el.type === 'stroke') return el.data.style.opacity;
    if (el.type === 'text') return el.data.style.opacity;
    return 1;
}

function opacityPatch(el: Element, opacity: number): Partial<Element['data']> {
    if (el.type === 'shape') return { style: { stroke: { opacity }, fill: { opacity } } } as any;
    if (el.type === 'linear' || el.type === 'stroke') return { style: { opacity } } as any;
    if (el.type === 'text') return { style: { opacity } } as any;
    return {} as any;
}

function extractFontFamily(el: TextElement): string {
    const ff = el.data.style.fontFamily;
    if (ff.includes('Virgil')) return 'Virgil';
    if (ff.includes('Cascadia')) return 'Cascadia';
    return 'system-ui';
}
