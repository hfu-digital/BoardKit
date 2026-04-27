// CDN URLs for Virgil + Cascadia. Vite library mode insists on base64-inlining
// any locally-imported font (?url, new URL, raw @font-face all bloat the bundle
// by ~150 KB), so we point at Excalidraw's long-stable CDN copies. font-display:
// swap means a system font shows instantly and the woff2 swaps in once fetched —
// if the CDN is offline, the fallback font stays. M6 can revisit self-hosting
// via a separate @hfu.digital/boardkit-fonts npm package if we want full
// independence from excalidraw.com.
const virgilUrl = 'https://excalidraw.com/Virgil.woff2';
const cascadiaUrl = 'https://excalidraw.com/Cascadia.woff2';

let injected = false;

export function ensureBoardKitFonts(): void {
    // Server-side / non-DOM environments: silently skip. Components that depend
    // on these fonts use a system fallback in CSS.
    if (typeof document === 'undefined') return;
    if (injected) return;
    injected = true;
    const style = document.createElement('style');
    style.setAttribute('data-boardkit-fonts', '');
    style.textContent = `
@font-face {
    font-family: 'Virgil';
    src: url('${virgilUrl}') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'Cascadia';
    src: url('${cascadiaUrl}') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}
`;
    document.head.appendChild(style);
}

ensureBoardKitFonts();
