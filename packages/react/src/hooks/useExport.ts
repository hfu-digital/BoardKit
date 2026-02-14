import { useState, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';

export interface UseExportResult {
    exportPng: () => Promise<string>;
    exportPdf: () => Promise<void>;
    isExporting: boolean;
}

export function useExport(boardId: string): UseExportResult {
    const { renderer, config } = useBoardKit();
    const [isExporting, setIsExporting] = useState(false);

    const exportPng = useCallback(async (): Promise<string> => {
        setIsExporting(true);
        try {
            return renderer.toDataURL('image/png', 1.0);
        } finally {
            setIsExporting(false);
        }
    }, [renderer]);

    const exportPdf = useCallback(async (): Promise<void> => {
        setIsExporting(true);
        try {
            const res = await fetch(`${config.apiUrl}/boards/${boardId}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
                },
                body: JSON.stringify({ format: 'pdf' }),
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `board-${boardId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setIsExporting(false);
        }
    }, [boardId, config.apiUrl, config.authToken]);

    return { exportPng, exportPdf, isExporting };
}
