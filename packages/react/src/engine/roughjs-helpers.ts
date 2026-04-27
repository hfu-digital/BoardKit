import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Options } from 'roughjs/bin/core';
import type { ShapeStyle, StrokeStyle, FillStyle } from '@hfu.digital/boardkit-core';

/**
 * Lazily attach a RoughCanvas to each HTMLCanvasElement and reuse the
 * instance. Creating one per render call is cheap but the WeakMap keeps the
 * instance pinned to the canvas's lifetime so we avoid the few-object
 * allocations on the hot path. WeakMap auto-clears when canvases are GC'd.
 */
const roughCanvasCache = new WeakMap<HTMLCanvasElement, RoughCanvas>();

export function getRoughCanvas(ctx: CanvasRenderingContext2D): RoughCanvas {
    const canvas = ctx.canvas;
    let rc = roughCanvasCache.get(canvas);
    if (!rc) {
        rc = rough.canvas(canvas);
        roughCanvasCache.set(canvas, rc);
    }
    return rc;
}

/**
 * Map our user-facing sloppiness levels to Rough.js's `roughness` parameter.
 * Architect (0) collapses to a non-zero floor so closed shapes still render
 * via Rough.js for consistent look — the dedicated "perfectly clean" path
 * skips Rough.js entirely (see roughness === 0 short-circuit in renderers).
 */
const ROUGHNESS_MAP: Record<0 | 1 | 2, number> = {
    0: 0.5, // architect — barely visible wobble (only used if forced through Rough.js)
    1: 1.5, // artist — Rough.js default-ish, balanced sketch
    2: 2.8, // cartoonist — pronounced wobble
};

export function roughnessToFloat(level: 0 | 1 | 2): number {
    return ROUGHNESS_MAP[level];
}

/**
 * Translate our domain ShapeStyle to a Rough.js Options object. Returns
 * `null` if the shape has no visible outline and no fill (caller should skip
 * drawing entirely).
 */
export function shapeStyleToRoughOptions(style: ShapeStyle): Options | null {
    const hasStroke = style.stroke.opacity > 0 && style.stroke.width > 0;
    const hasFill = style.fill.type !== 'none' && style.fill.opacity > 0;
    if (!hasStroke && !hasFill) return null;

    const options: Options = {
        roughness: roughnessToFloat(style.roughness),
        seed: style.seed,
        // Default `bowing` of 1 is a touch much for HFU's clean-leaning brand;
        // 0.7 keeps shapes recognisable while still feeling hand-drawn.
        bowing: 0.7,
        preserveVertices: true,
    };

    if (hasStroke) {
        options.stroke = withOpacity(style.stroke.color, style.stroke.opacity);
        options.strokeWidth = style.stroke.width;
        if (style.stroke.pattern === 'dashed') options.strokeLineDash = [10, 5];
        else if (style.stroke.pattern === 'dotted') options.strokeLineDash = [2, 4];
    } else {
        options.stroke = 'none';
    }

    if (hasFill) {
        options.fill = withOpacity(style.fill.color, style.fill.opacity);
        // Fill style mapping: our 'solid' / 'hachure' / 'cross-hatch' / 'zigzag'
        // / 'dots' map directly to Rough.js's vocabulary.
        options.fillStyle = style.fill.type === 'solid'
            ? 'solid'
            : style.fill.type === 'cross-hatch'
                ? 'cross-hatch'
                : style.fill.type === 'zigzag'
                    ? 'zigzag'
                    : style.fill.type === 'dots'
                        ? 'dots'
                        : 'hachure';
        options.fillWeight = Math.max(1, style.stroke.width * 0.6);
        options.hachureGap = Math.max(4, style.stroke.width * 4);
    }

    return options;
}

/**
 * Translate a StrokeStyle (used by Linear elements) to Rough.js options. No
 * fill — linear elements are stroke-only.
 */
export function strokeStyleToRoughOptions(
    style: StrokeStyle,
    roughness: 0 | 1 | 2,
    seed: number,
): Options {
    const options: Options = {
        roughness: roughnessToFloat(roughness),
        seed,
        bowing: 0.7,
        preserveVertices: true,
        stroke: withOpacity(style.color, style.opacity),
        strokeWidth: style.width,
    };
    if (style.pattern === 'dashed') options.strokeLineDash = [10, 5];
    else if (style.pattern === 'dotted') options.strokeLineDash = [2, 4];
    return options;
}

/**
 * Compose RGBA color when opacity < 1. Rough.js treats `stroke`/`fill` as
 * raw CSS color strings and respects rgba alpha. We avoid touching
 * ctx.globalAlpha (which would composite the ENTIRE rough drawing including
 * its hachure under-strokes; baking opacity into the color is more correct).
 */
function withOpacity(color: string, opacity: number): string {
    if (opacity >= 1) return color;
    // Already rgba/hex with alpha — pass through.
    if (color.startsWith('rgba(') || (color.startsWith('#') && color.length === 9)) {
        return color;
    }
    // Hex shorthand (#RGB) → expand
    if (color.startsWith('#') && color.length === 4) {
        const r = parseInt(color[1] + color[1], 16);
        const g = parseInt(color[2] + color[2], 16);
        const b = parseInt(color[3] + color[3], 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Hex (#RRGGBB) → rgba
    if (color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // rgb(...) → rgba(...)
    if (color.startsWith('rgb(')) {
        return color.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${opacity})`);
    }
    // Named colors: trust caller, drop opacity (rare path).
    return color;
}

export type { FillStyle };
