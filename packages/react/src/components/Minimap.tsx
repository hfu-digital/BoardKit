import React, { useRef, useEffect, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';
import type { Element, Rect } from '@hfu.digital/boardkit-core';
import { calculateBounds, mergeBounds } from '@hfu.digital/boardkit-core';

export interface MinimapProps {
    width?: number;
    height?: number;
    className?: string;
}

export function Minimap({ width = 200, height = 150, className }: MinimapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { store } = useBoardKit();

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { scene, viewport } = store.getState();
        const elements = Array.from(scene.elements.values());

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);

        if (elements.length === 0) return;

        // Calculate content bounds
        const allBounds = elements.map((el) => calculateBounds(el));
        const contentBounds = mergeBounds(allBounds);

        // Add padding
        const padding = 20;
        const expandedBounds: Rect = {
            x: contentBounds.x - padding,
            y: contentBounds.y - padding,
            width: contentBounds.width + padding * 2,
            height: contentBounds.height + padding * 2,
        };

        // Also include the current viewport area in the bounds
        const viewportWorldLeft = -viewport.offset.x / viewport.zoom;
        const viewportWorldTop = -viewport.offset.y / viewport.zoom;
        const viewportWorldWidth = window.innerWidth / viewport.zoom;
        const viewportWorldHeight = window.innerHeight / viewport.zoom;

        const totalBounds = mergeBounds([
            expandedBounds,
            {
                x: viewportWorldLeft,
                y: viewportWorldTop,
                width: viewportWorldWidth,
                height: viewportWorldHeight,
            },
        ]);

        if (totalBounds.width === 0 || totalBounds.height === 0) return;

        // Calculate scale to fit minimap
        const scaleX = width / totalBounds.width;
        const scaleY = height / totalBounds.height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (width - totalBounds.width * scale) / 2;
        const offsetY = (height - totalBounds.height * scale) / 2;

        // Transform helper
        const toMinimap = (wx: number, wy: number): [number, number] => [
            offsetX + (wx - totalBounds.x) * scale,
            offsetY + (wy - totalBounds.y) * scale,
        ];

        // Render elements as simplified shapes
        for (const el of elements) {
            const bounds = calculateBounds(el);
            const [mx, my] = toMinimap(bounds.x, bounds.y);
            const mw = bounds.width * scale;
            const mh = bounds.height * scale;

            switch (el.type) {
                case 'stroke':
                    ctx.fillStyle = el.data.style?.color ?? '#333';
                    ctx.fillRect(mx, my, Math.max(mw, 1), Math.max(mh, 1));
                    break;
                case 'shape':
                    ctx.fillStyle = el.data.style.fill.type === 'none'
                        ? 'rgba(100, 100, 200, 0.5)'
                        : el.data.style.fill.color;
                    ctx.fillRect(mx, my, mw, mh);
                    break;
                case 'linear':
                    ctx.fillStyle = el.data.style.color;
                    ctx.fillRect(mx, my, Math.max(mw, 1), Math.max(mh, 1));
                    break;
                case 'text':
                    ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
                    ctx.fillRect(mx, my, mw, Math.max(mh, 2));
                    break;
                case 'image':
                    ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
                    ctx.fillRect(mx, my, mw, mh);
                    break;
                default:
                    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
                    ctx.fillRect(mx, my, mw, mh);
                    break;
            }
        }

        // Render viewport indicator
        const [vx, vy] = toMinimap(viewportWorldLeft, viewportWorldTop);
        const vw = viewportWorldWidth * scale;
        const vh = viewportWorldHeight * scale;

        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.strokeRect(vx, vy, vw, vh);
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(vx, vy, vw, vh);
    }, [store, width, height]);

    // Re-render on scene/viewport changes
    useEffect(() => {
        const unsubs = [
            store.subscribe('scene', render),
            store.subscribe('viewport', render),
        ];
        render(); // Initial render
        return () => unsubs.forEach((u) => u());
    }, [store, render]);

    // Handle click to navigate
    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const { scene, viewport } = store.getState();
        const elements = Array.from(scene.elements.values());
        if (elements.length === 0) return;

        // Recalculate bounds (same logic as render)
        const allBounds = elements.map((el) => calculateBounds(el));
        const contentBounds = mergeBounds(allBounds);
        const padding = 20;
        const expandedBounds: Rect = {
            x: contentBounds.x - padding,
            y: contentBounds.y - padding,
            width: contentBounds.width + padding * 2,
            height: contentBounds.height + padding * 2,
        };

        const viewportWorldLeft = -viewport.offset.x / viewport.zoom;
        const viewportWorldTop = -viewport.offset.y / viewport.zoom;
        const viewportWorldWidth = window.innerWidth / viewport.zoom;
        const viewportWorldHeight = window.innerHeight / viewport.zoom;

        const totalBounds = mergeBounds([
            expandedBounds,
            {
                x: viewportWorldLeft,
                y: viewportWorldTop,
                width: viewportWorldWidth,
                height: viewportWorldHeight,
            },
        ]);

        if (totalBounds.width === 0 || totalBounds.height === 0) return;

        const scaleX = width / totalBounds.width;
        const scaleY = height / totalBounds.height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (width - totalBounds.width * scale) / 2;
        const offsetY = (height - totalBounds.height * scale) / 2;

        // Convert minimap click to world coordinates
        const worldX = (clickX - offsetX) / scale + totalBounds.x;
        const worldY = (clickY - offsetY) / scale + totalBounds.y;

        // Center viewport on clicked position
        store.updateViewport((vp) => ({
            zoom: vp.zoom,
            offset: {
                x: window.innerWidth / 2 - worldX * vp.zoom,
                y: window.innerHeight / 2 - worldY * vp.zoom,
            },
        }));
    }, [store, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleClick}
            className={className}
            style={{
                border: '1px solid #ddd',
                borderRadius: 4,
                cursor: 'pointer',
                backgroundColor: '#f5f5f5',
            }}
        />
    );
}
