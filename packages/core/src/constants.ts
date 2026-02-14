import type { StrokeStyle, FillStyle, TextStyle } from './types/styles';

export const TOOL_IDS = {
    PEN: 'pen',
    SHAPE: 'shape',
    SELECT: 'select',
    ERASER: 'eraser',
    TEXT: 'text',
    HAND: 'hand',
    STICKY_NOTE: 'stickyNote',
    CONNECTOR: 'connector',
    LASER: 'laser',
} as const;

export const LIMITS = {
    MAX_ELEMENTS_PER_PAGE: 10_000,
    MAX_PAGES_PER_BOARD: 100,
    MAX_ASSET_SIZE_MB: 25,
    MAX_BOARD_SIZE_MB: 100,
} as const;

export const DEFAULT_STROKE_STYLE: StrokeStyle = {
    color: '#000000',
    width: 2,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
};

export const DEFAULT_FILL_STYLE: FillStyle = {
    type: 'none',
    color: '#000000',
    opacity: 1,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
    fontFamily: 'sans-serif',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    textAlign: 'left',
};
