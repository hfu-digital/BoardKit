/**
 * Excalidraw's stroke + fill swatches. Hand-picked for legibility against both
 * light and dark canvas backgrounds. Includes "transparent" as a stroke
 * option (becomes opacity:0 on the actual element).
 */
export const EXCALIDRAW_STROKE_COLORS = [
    '#1b1b1f', // black
    '#5c5c66', // gray
    '#e03131', // red
    '#2f9e44', // green
    '#1971c2', // blue
    '#f08c00', // orange
    '#9c36b5', // purple
    '#0c8599', // teal
] as const;

export const EXCALIDRAW_FILL_COLORS = [
    'transparent',
    '#ffc9c9', // soft red
    '#b2f2bb', // soft green
    '#a5d8ff', // soft blue
    '#ffec99', // soft yellow
    '#e599f7', // soft purple
    '#99e9f2', // soft teal
    '#ced4da', // soft gray
] as const;

export const EXCALIDRAW_PALETTE = {
    stroke: EXCALIDRAW_STROKE_COLORS,
    fill: EXCALIDRAW_FILL_COLORS,
};
