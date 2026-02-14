import React, { useState, useCallback } from 'react';
import { useBoardKit } from '../context/BoardKitProvider';

export interface ShareDialogProps {
    boardId: string;
    open: boolean;
    onClose: () => void;
    className?: string;
}

export function ShareDialog({ boardId, open, onClose, className }: ShareDialogProps) {
    const { config } = useBoardKit();
    const [permission, setPermission] = useState<'view' | 'edit'>('view');
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const createLink = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${config.apiUrl}/boards/${boardId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
                },
                body: JSON.stringify({ permission }),
            });
            if (!res.ok) throw new Error('Failed to create share link');
            const data = await res.json();
            setShareUrl(`${window.location.origin}/board/${boardId}?token=${data.token}`);
        } finally {
            setLoading(false);
        }
    }, [boardId, config.apiUrl, config.authToken, permission]);

    if (!open) return null;

    return (
        <div className={className} role="dialog" aria-label="Share board">
            <h3>Share Board</h3>
            <div>
                <label>
                    <input
                        type="radio"
                        name="permission"
                        value="view"
                        checked={permission === 'view'}
                        onChange={() => setPermission('view')}
                    />
                    View only
                </label>
                <label>
                    <input
                        type="radio"
                        name="permission"
                        value="edit"
                        checked={permission === 'edit'}
                        onChange={() => setPermission('edit')}
                    />
                    Can edit
                </label>
            </div>
            <button onClick={createLink} disabled={loading}>
                {loading ? 'Creating...' : 'Create Link'}
            </button>
            {shareUrl && (
                <div>
                    <input type="text" value={shareUrl} readOnly style={{ width: '100%' }} />
                    <button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</button>
                </div>
            )}
            <button onClick={onClose}>Close</button>
        </div>
    );
}
