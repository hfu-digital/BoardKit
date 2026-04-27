/**
 * Stroke appearance for any line or shape outline. The same shape ships flat
 * `solid` strokes when `roughness` (on the parent ShapeStyle) is 0, and the
 * Rough.js renderer interprets these same fields when roughness > 0.
 */
export interface StrokeStyle {
    color: string;
    width: number;
    opacity: number;
    lineCap: 'round' | 'butt' | 'square';
    lineJoin: 'round' | 'bevel' | 'miter';
    /** 'solid' = continuous, 'dashed' = [10,5], 'dotted' = [2,3]. */
    pattern: 'solid' | 'dashed' | 'dotted';
}

/**
 * Fill appearance for closed shapes. `none` skips fill entirely. `solid` paints
 * a flat color. The remaining variants map directly to Rough.js fillStyle
 * options and are only meaningful when the parent shape is being rendered
 * with roughness > 0; for solid-line shapes they fall back to `solid`.
 */
export interface FillStyle {
    type: 'none' | 'solid' | 'hachure' | 'cross-hatch' | 'zigzag' | 'dots';
    color: string;
    opacity: number;
}

/**
 * Combined style for closed shapes (rectangle / diamond / ellipse). The
 * roughness + seed fields are read by the Rough.js renderer in M3 — keeping
 * them on the data model means the same element renders identically on every
 * client and after every reload (deterministic seed).
 */
export interface ShapeStyle {
    stroke: StrokeStyle;
    fill: FillStyle;
    /** 0 = perfectly clean (architect), 1 = artist, 2 = cartoonist. */
    roughness: 0 | 1 | 2;
    /** Stable seed for Rough.js so the same element renders identically every time. */
    seed: number;
    /** 0 = sharp corners, >0 = rounded corner radius (only applies to rectangle). */
    cornerRadius: number;
}

export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    textAlign: 'left' | 'center' | 'right';
    opacity: number;
}
