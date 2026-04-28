/**
 * Auth-bridged asset resolver.
 *
 * `<img src>` cannot send `Authorization: Bearer ...` headers, so we fetch
 * authenticated asset URLs ourselves, wrap the response as a blob, and hand
 * the resulting `blob:` URL to the renderer. The renderer then loads it as
 * a regular image without any cross-origin or auth concerns.
 *
 * Configuration is module-level (singleton) — `BoardKitProvider` calls
 * `configureAssetResolver()` so the renderer (which has no React context)
 * can call `getResolvedAssetUrl()` synchronously per frame.
 *
 * State per canonical URL:
 *   - 'loading': fetch in flight; renderer skips drawing this frame
 *   - 'ready':   blobUrl is populated and stable
 *   - 'error':   fetch failed; will be retried after RETRY_BACKOFF_MS
 */

type EntryState = 'loading' | 'ready' | 'error';

interface Entry {
    state: EntryState;
    blobUrl?: string;
    lastErrorAt?: number;
}

interface ResolverConfig {
    apiUrl: string;
    getAuthToken: () => string | undefined;
    /**
     * Optional share-link token. When set (and there's no auth token), the
     * resolver passes it to the asset endpoint via `x-share-token` so a
     * share-link viewer can fetch otherwise-auth-gated assets.
     */
    getShareToken?: () => string | undefined;
}

const RETRY_BACKOFF_MS = 5_000;

const cache = new Map<string, Entry>();
let config: ResolverConfig | null = null;

/**
 * Subscribers fire after every fetch terminates (success or error). The
 * BoardKitProvider wires `renderer.invalidateScene` so the next rAF tick
 * picks up the freshly-cached blob URL and the image actually paints.
 */
const readySubscribers = new Set<() => void>();

export function subscribeAssetReady(cb: () => void): () => void {
    readySubscribers.add(cb);
    return () => {
        readySubscribers.delete(cb);
    };
}

function notifyAssetReady(): void {
    for (const cb of readySubscribers) cb();
}

export function configureAssetResolver(next: ResolverConfig): void {
    config = next;
}

/**
 * Reset the resolver and revoke any blob URLs we created. Call from the
 * BoardKitProvider unmount effect to avoid leaking blob URLs across remounts.
 */
export function resetAssetResolver(): void {
    for (const entry of cache.values()) {
        if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
    }
    cache.clear();
    readySubscribers.clear();
    config = null;
}

/**
 * Resolve a canonical asset URL to a blob URL the browser can render.
 *
 * Returns `undefined` while loading or while in error backoff — the renderer
 * should simply skip drawing this frame. Once the fetch succeeds, the blob
 * URL is stable for the lifetime of the resolver and subsequent calls return
 * it synchronously.
 *
 * Non-API URLs (data: / blob: / cross-origin http(s)) are returned as-is so
 * legacy elements with absolute external URLs keep working.
 */
export function getResolvedAssetUrl(url: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (!config) {
        return url;
    }
    // If neither auth nor share token is available, fall back to direct
    // loading — works for genuinely public URLs and for tests without a
    // provider. With either token we go through fetchAsset to attach the
    // appropriate header.
    const hasAuth = !!config.getAuthToken();
    const hasShare = !!config.getShareToken?.();
    if (!hasAuth && !hasShare) {
        return url;
    }

    const cached = cache.get(url);
    if (cached) {
        if (cached.state === 'ready') return cached.blobUrl;
        if (cached.state === 'loading') return undefined;
        // 'error' — retry after the backoff window
        if (
            cached.lastErrorAt &&
            Date.now() - cached.lastErrorAt < RETRY_BACKOFF_MS
        ) {
            return undefined;
        }
    }

    void fetchAsset(url);
    return undefined;
}

async function fetchAsset(url: string): Promise<void> {
    if (!config) return;
    cache.set(url, { state: 'loading' });
    try {
        const token = config.getAuthToken();
        const shareToken = config.getShareToken?.();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        else if (shareToken) headers['x-share-token'] = shareToken;
        const res = await fetch(url, { headers });
        if (!res.ok) {
            throw new Error(`asset fetch ${url} returned ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        cache.set(url, { state: 'ready', blobUrl });
        notifyAssetReady();
    } catch (err) {
        cache.set(url, { state: 'error', lastErrorAt: Date.now() });
        // eslint-disable-next-line no-console
        console.warn('[boardkit] asset fetch failed:', url, err);
        notifyAssetReady();
    }
}
