import type { ViewportState } from './viewport';
import type { GridConfig } from '@hfu.digital/boardkit-core';

export function renderGrid(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportState,
    gridConfig: GridConfig,
    canvasWidth: number,
    canvasHeight: number,
): void {
    if (!gridConfig.visible || !gridConfig.enabled) return;

    ctx.save();

    const { zoom, offset } = viewport;
    const gridSize = gridConfig.size * zoom;

    // Only render if grid is visible (not too dense or too sparse)
    if (gridSize < 8 || gridSize > 200) {
        ctx.restore();
        return;
    }

    // Calculate visible grid range
    const startX = (offset.x % gridSize);
    const startY = (offset.y % gridSize);

    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    for (let x = startX; x < canvasWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
    }
    for (let y = startY; y < canvasHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
    }
    ctx.stroke();

    ctx.restore();
}
