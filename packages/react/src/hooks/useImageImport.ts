import { useState, useEffect, useCallback } from 'react';
import { addElement } from '@boardkit/core';
import type { ImageElement } from '@boardkit/core';
import { useBoardKit } from '../context/BoardKitProvider';

let imageIdCounter = 0;
function generateImageId(): string {
    return `image-${++imageIdCounter}-${Date.now()}`;
}

export interface UseImageImportResult {
    importImage: (file: File) => Promise<void>;
    importFromUrl: (url: string) => Promise<void>;
    isDragging: boolean;
    isUploading: boolean;
}

export function useImageImport(boardId: string): UseImageImportResult {
    const { store, config } = useBoardKit();
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const createImageElement = useCallback(
        (assetId: string, url: string, width: number, height: number) => {
            const { viewport, activePageId } = store.getState();
            const pageId = activePageId ?? '';

            // Place the image at the center of the viewport
            const centerX = (window.innerWidth / 2 - viewport.offset.x) / viewport.zoom;
            const centerY = (window.innerHeight / 2 - viewport.offset.y) / viewport.zoom;

            const position = {
                x: centerX - width / 2,
                y: centerY - height / 2,
            };

            const now = new Date().toISOString();
            const elementId = generateImageId();

            const element: ImageElement = {
                id: elementId,
                pageId,
                type: 'image',
                zIndex: Date.now(),
                createdBy: '',
                createdAt: now,
                updatedAt: now,
                data: {
                    assetId,
                    url,
                    position,
                    size: { width, height },
                    rotation: 0,
                    bounds: {
                        x: position.x,
                        y: position.y,
                        width,
                        height,
                    },
                },
            };

            store.updateScene((scene) => addElement(scene, element));
        },
        [store],
    );

    const loadImageDimensions = useCallback(
        (url: string): Promise<{ width: number; height: number }> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    // Cap image size to a reasonable default for the canvas
                    const maxDim = 800;
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;
                    if (width > maxDim || height > maxDim) {
                        const scale = maxDim / Math.max(width, height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }
                    resolve({ width, height });
                };
                img.onerror = () => {
                    // Fallback to default size
                    resolve({ width: 400, height: 300 });
                };
                img.src = url;
            });
        },
        [],
    );

    const importImage = useCallback(
        async (file: File) => {
            setIsUploading(true);
            try {
                // Read file as base64
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        // Strip the data URL prefix to get raw base64
                        const base64Data = result.split(',')[1] ?? result;
                        resolve(base64Data);
                    };
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });

                // Upload to the asset endpoint
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (config.authToken) {
                    headers['Authorization'] = `Bearer ${config.authToken}`;
                }

                const res = await fetch(
                    `${config.apiUrl}/boards/${boardId}/assets`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            data: base64,
                            mimeType: file.type,
                            sizeBytes: file.size,
                        }),
                    },
                );

                if (!res.ok) {
                    throw new Error(`Upload failed: ${res.status}`);
                }

                const asset = await res.json();
                const url: string = asset.url ?? asset.storageKey ?? '';
                const assetId: string = asset.id ?? '';

                // Determine image dimensions
                const objectUrl = URL.createObjectURL(file);
                const dimensions = await loadImageDimensions(objectUrl);
                URL.revokeObjectURL(objectUrl);

                createImageElement(assetId, url, dimensions.width, dimensions.height);
            } finally {
                setIsUploading(false);
            }
        },
        [boardId, config.apiUrl, config.authToken, createImageElement, loadImageDimensions],
    );

    const importFromUrl = useCallback(
        async (url: string) => {
            setIsUploading(true);
            try {
                const dimensions = await loadImageDimensions(url);
                // Use URL directly as both assetId placeholder and URL
                createImageElement('', url, dimensions.width, dimensions.height);
            } finally {
                setIsUploading(false);
            }
        },
        [createImageElement, loadImageDimensions],
    );

    // Set up drag & drop listeners
    useEffect(() => {
        let dragCounter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer?.types.includes('Files')) {
                setIsDragging(true);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                setIsDragging(false);
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter = 0;
            setIsDragging(false);

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('image/')) {
                    importImage(file);
                }
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, [importImage]);

    return { importImage, importFromUrl, isDragging, isUploading };
}
