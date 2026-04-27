/**
 * HFU brand-aligned palette. Lead with HFU purple, then state51 semantic
 * colors (success / warning / destructive / info), then neutrals. Designed
 * to feel cohesive on hfu.digital while still being expressive enough for
 * a whiteboard.
 */
export const HFU_STROKE_COLORS = [
    '#1b1b1f', // ink
    '#9b2d9b', // HFU purple
    '#d04444', // destructive
    '#2faa6b', // success
    '#4f70d9', // info
    '#d68d2c', // warning
    '#5c5c66', // gray
    '#0c8599', // teal
] as const;

export const HFU_FILL_COLORS = [
    'transparent',
    '#f1d9f1', // purple wash
    '#fdd6d6', // red wash
    '#cef0db', // green wash
    '#d8e0f7', // blue wash
    '#f8e3c7', // amber wash
    '#dee2e6', // gray wash
    '#cdeef3', // teal wash
] as const;

export const HFU_PALETTE = {
    stroke: HFU_STROKE_COLORS,
    fill: HFU_FILL_COLORS,
};
