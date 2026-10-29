import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssetResolver, configureAssetResolver, getResolvedAssetUrl, resetAssetResolver, subscribeAssetReady } from '../engine/asset-resolver';

afterEach(() => { resetAssetResolver(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('asset resolver cleanup', () => {
    it('aborts pending fetches and ignores late completions after remount', async () => {
        let complete!: (value: any) => void;
        const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
            .mockResolvedValue({ ok: true, blob: async () => new Blob(['new']) });
        vi.stubGlobal('fetch', fetchMock);
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const configure = () => configureAssetResolver({ apiUrl: 'https://api.test/api', getAuthToken: () => 'token' });
        configure();
        getResolvedAssetUrl('https://api.test/api/boards/board/assets/asset');
        const signal = fetchMock.mock.calls[0][1].signal;
        resetAssetResolver();
        expect(signal.aborted).toBe(true);
        configure();
        const ready = vi.fn();
        subscribeAssetReady(ready);
        getResolvedAssetUrl('https://api.test/api/boards/board/assets/asset');
        await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
        complete({ ok: true, blob: async () => new Blob(['old']) });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(create).toHaveBeenCalledTimes(1);
        expect(getResolvedAssetUrl('https://api.test/api/boards/board/assets/asset')).toBe('blob:new');
        resetAssetResolver();
        expect(revoke).toHaveBeenCalledWith('blob:new');
    });
});

 it('isolates auth scopes and retains canonical relative URLs until removal', async () => {
    const a = createAssetResolver(), b = createAssetResolver();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x']) });
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    a.configureAssetResolver({ apiUrl: 'https://api.test/api', getAuthToken: () => 'a' });
    b.configureAssetResolver({ apiUrl: 'https://api.test/api', getAuthToken: () => 'b' });
    const url = '/api/boards/board/assets/asset';
    a.getResolvedAssetUrl(url); b.getResolvedAssetUrl(url);
    await vi.waitFor(() => expect(a.getResolvedAssetUrl(url)).toBe('blob:a'));
    expect(fetcher.mock.calls.map(call => call[1].headers.Authorization)).toEqual(['Bearer a', 'Bearer b']);
    a.retain(new Set([url])); expect(revoke).not.toHaveBeenCalled();
    a.resetAssetResolver(); expect(revoke).toHaveBeenCalledWith('blob:a');
    expect(b.getResolvedAssetUrl(url)).toBe('blob:b');
    b.retain(new Set()); expect(revoke).toHaveBeenCalledWith('blob:b');
    b.resetAssetResolver();
 });
