import { afterEach, it, expect, vi } from 'vitest';
import { configureAssetResolver, resetAssetResolver, getResolvedAssetUrl } from '../engine/asset-resolver';
afterEach(() => { resetAssetResolver(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each(['https://evil.test/image','//evil.test/image','https://api.test/private','https://api.test/api/boards/a/assets/b/other','javascript:alert(1)','https://user:pass@api.test/api/boards/a/assets/b'])('never attaches credentials to %s', url => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    configureAssetResolver({apiUrl:'https://api.test/api',getAuthToken:()=> 'bearer',getShareToken:()=> 'share'});
    getResolvedAssetUrl(url);
    expect(fetcher).not.toHaveBeenCalled();
});
it('scopes both credentials to an asset endpoint and prohibits redirects', () => {
    const fetcher = vi.fn().mockImplementation(()=> new Promise(()=>{})); vi.stubGlobal('fetch',fetcher);
    configureAssetResolver({apiUrl:'https://api.test/api',getAuthToken:()=> 'bearer',getShareToken:()=> 'share'});
    getResolvedAssetUrl('/api/boards/a/assets/b');
    expect(fetcher).toHaveBeenCalledWith('https://api.test/api/boards/a/assets/b',expect.objectContaining({
        headers:{Authorization:'Bearer bearer','x-share-token':'share'},redirect:'error',credentials:'omit',
    }));
});
