import type { StrokeStyle, FillStyle, ShapeStyle, TextStyle } from './types/styles';

/**
 * Excalidraw-aligned tool set. Letter shortcuts on the keyboard match
 * Excalidraw's defaults so muscle memory transfers (V/R/D/O/A/L/P/T/I/E/H/K).
 */
export const TOOL_IDS = {
    SELECT: 'select',
    RECTANGLE: 'rectangle',
    DIAMOND: 'diamond',
    ELLIPSE: 'ellipse',
    ARROW: 'arrow',
    LINE: 'line',
    PEN: 'pen',
    TEXT: 'text',
    IMAGE: 'image',
    ERASER: 'eraser',
    HAND: 'hand',
    LASER: 'laser',
} as const;

export const LIMITS = {
    MAX_ELEMENTS_PER_PAGE: 10_000,
    MAX_PAGES_PER_BOARD: 100,
    MAX_ASSET_SIZE_MB: 25,
    MAX_BOARD_SIZE_MB: 100,
} as const;

export const DEFAULT_STROKE_STYLE: StrokeStyle = {
    color: '#1b1b1f',
    width: 2,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    pattern: 'solid',
};

export const DEFAULT_FILL_STYLE: FillStyle = {
    type: 'none',
    color: '#1b1b1f',
    opacity: 1,
};

/**
 * The default seed is 1 (not 0, since Rough.js treats 0 as "use random seed"
 * which would re-randomise on every render). Tool-creation code overrides
 * with a per-element random seed so distinct shapes look distinct.
 */
export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
    stroke: { ...DEFAULT_STROKE_STYLE },
    fill: { ...DEFAULT_FILL_STYLE },
    roughness: 1,
    seed: 1,
    cornerRadius: 0,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
    fontFamily: 'Virgil, Caveat, system-ui, sans-serif',
    fontSize: 20,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#1b1b1f',
    textAlign: 'left',
    opacity: 1,
};

/** Random seed in the int32 range Rough.js expects. */
export function generateRoughSeed(): number {
    return Math.floor(Math.random() * 2 ** 31);
}
