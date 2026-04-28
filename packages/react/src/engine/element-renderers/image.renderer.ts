import type { ImageElement } from '@hfu.digital/boardkit-core';
import { getResolvedAssetUrl } from '../asset-resolver';

/**
 * Renderer cache state per resolved (blob/data/external) URL.
 *
 * `state` lets us distinguish "still loading" from "load failed" — the latter
 * is what triggered the original `InvalidStateError`: drawImage rejects
 * HTMLImageElements in the broken state. We never call drawImage unless
 * state === 'ready' AND naturalWidth > 0 (defense in depth).
 *
 * Failed entries are evicted after a short backoff so transient network
 * blips can recover on a later frame instead of pinning the broken image
 * in the cache forever.
 */
type CacheState = 'loading' | 'ready' | 'broken';

interface CacheEntry {
    image: HTMLImageElement;
    state: CacheState;
    lastErrorAt?: number;
}

const RETRY_BACKOFF_MS = 5_000;
const imageCache = new Map<string, CacheEntry>();

/**
 * Subscribers fire when an image transitions to 'ready'. The BoardKitProvider
 * wires `renderer.invalidateScene` so a paint happens on the next rAF tick;
 * without it, the just-loaded image stays invisible until some unrelated
 * event causes a re-render.
 */
const readySubscribers = new Set<() => void>();

export function subscribeImageReady(cb: () => void): () => void {
    readySubscribers.add(cb);
    return () => {
        readySubscribers.delete(cb);
    };
}

function loadImage(resolvedUrl: string): CacheEntry {
    const image = new Image();
    const entry: CacheEntry = { image, state: 'loading' };
    image.onload = () => {
        entry.state = image.naturalWidth > 0 ? 'ready' : 'broken';
        if (entry.state === 'broken') entry.lastErrorAt = Date.now();
        if (entry.state === 'ready') {
            for (const cb of readySubscribers) cb();
        }
    };
    image.onerror = () => {
        entry.state = 'broken';
        entry.lastErrorAt = Date.now();
    };
    image.src = resolvedUrl;
    imageCache.set(resolvedUrl, entry);
    return entry;
}

export function renderImage(
    ctx: CanvasRenderingContext2D,
    element: ImageElement,
): void {
    const { url, position, size, rotation } = element.data;
    if (!url) return;

    // Resolve canonical (potentially auth-required) URL → blob/data URL the
    // browser can load directly. Returns undefined while loading.
    const resolvedUrl = getResolvedAssetUrl(url);
    if (!resolvedUrl) return;

    let entry = imageCache.get(resolvedUrl);
    if (!entry) {
        entry = loadImage(resolvedUrl);
        return;
    }

    if (entry.state === 'broken') {
        // Evict after backoff so the resolver can retry on a later frame.
        if (
            entry.lastErrorAt &&
            Date.now() - entry.lastErrorAt > RETRY_BACKOFF_MS
        ) {
            imageCache.delete(resolvedUrl);
        }
        return;
    }

    if (entry.state !== 'ready') return;
    if (entry.image.naturalWidth === 0) {
        // Edge case — the underlying <img> entered the broken state after we
        // marked it ready (e.g. browser revoked the blob URL). Re-mark and
        // bail out without crashing.
        entry.state = 'broken';
        entry.lastErrorAt = Date.now();
        return;
    }

    ctx.save();
    // Compensate for any CSS filter applied to a canvas ancestor (e.g. the
    // dark-mode `filter: invert(1) hue-rotate(180deg)` trick used by
    // consumers to invert text/strokes/UI without re-theming). Photos look
    // wrong under that filter; reapplying the same filter to the canvas
    // pixels of the image cancels out (it's its own inverse), so users see
    // natural image colours regardless of theme.
    const compensatingFilter = getCompensatingFilter(ctx.canvas);
    if (compensatingFilter !== 'none') {
        ctx.filter = compensatingFilter;
    }
    ctx.translate(position.x + size.width / 2, position.y + size.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    try {
        ctx.drawImage(
            entry.image,
            -(size.width / 2),
            -(size.height / 2),
            size.width,
            size.height,
        );
    } catch (err) {
        // Defensive: drawImage can still throw for some pathological broken
        // states. Evict and warn instead of letting the error escape into
        // the rAF loop and crash the canvas.
        // eslint-disable-next-line no-console
        console.warn('[boardkit] drawImage failed; evicting cache entry', err);
        entry.state = 'broken';
        entry.lastErrorAt = Date.now();
    }
    ctx.restore();
}

/**
 * Walk up from the canvas through ancestors and return the first non-`none`
 * computed `filter`. Returns 'none' if no ancestor applies a filter or if
 * the canvas is detached from the DOM. Cached only by the browser's own
 * style-resolution; called per-frame per-image but the work is cheap.
 */
function getCompensatingFilter(canvas: HTMLCanvasElement): string {
    if (typeof window === 'undefined') return 'none';
    let node: HTMLElement | null = canvas.parentElement;
    while (node) {
        const f = window.getComputedStyle(node).filter;
        if (f && f !== 'none') return f;
        node = node.parentElement;
    }
    return 'none';
}
