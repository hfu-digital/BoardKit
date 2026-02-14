import React, { useState } from 'react';
import { useExport } from '../hooks/useExport';

export interface ExportDialogProps {
    boardId: string;
    open: boolean;
    onClose: () => void;
    className?: string;
}

export function ExportDialog({ boardId, open, onClose, className }: ExportDialogProps) {
    const { exportPng, exportPdf, isExporting } = useExport(boardId);
    const [format, setFormat] = useState<'png' | 'pdf'>('png');

    const handleExport = async () => {
        if (format === 'png') {
            const dataUrl = await exportPng();
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `board-${boardId}.png`;
            a.click();
        } else {
            await exportPdf();
        }
        onClose();
    };

    if (!open) return null;

    return (
        <div className={className} role="dialog" aria-label="Export board">
            <h3>Export Board</h3>
            <div>
                <label>
                    <input
                        type="radio"
                        name="format"
                        value="png"
                        checked={format === 'png'}
                        onChange={() => setFormat('png')}
                    />
                    PNG
                </label>
                <label>
                    <input
                        type="radio"
                        name="format"
                        value="pdf"
                        checked={format === 'pdf'}
                        onChange={() => setFormat('pdf')}
                    />
                    PDF
                </label>
            </div>
            <button onClick={handleExport} disabled={isExporting}>
                {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button onClick={onClose}>Cancel</button>
        </div>
    );
}
