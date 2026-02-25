import type { ImageElement } from '@hfu.digital/boardkit-core';

const imageCache = new Map<string, HTMLImageElement>();

export function renderImage(
    ctx: CanvasRenderingContext2D,
    element: ImageElement,
): void {
    const { url, position, size, rotation } = element.data;

    let img = imageCache.get(url);
    if (!img) {
        img = new Image();
        img.src = url;
        imageCache.set(url, img);
        img.onload = () => {
            // Will be rendered on next frame
        };
        return;
    }

    if (!img.complete) return;

    ctx.save();
    ctx.translate(position.x + size.width / 2, position.y + size.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -(size.width / 2), -(size.height / 2), size.width, size.height);
    ctx.restore();
}
