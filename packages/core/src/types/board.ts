export interface Board {
    id: string;
    name: string;
    ownerId: string;
    sessionType: 'ephemeral' | 'persistent';
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Page {
    id: string;
    boardId: string;
    name: string;
    order: number;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BoardMember {
    boardId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
}

export interface ShareLink {
    id: string;
    boardId: string;
    token: string;
    permission: 'view' | 'edit';
    expiresAt?: string;
    createdAt: string;
}

export interface Asset {
    id: string;
    boardId: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedBy: string;
    createdAt: string;
    // Populated by the upload controller as a relative path
    // (e.g. `/boards/:boardId/assets/:assetId`). Clients absolutise this
    // against their configured API base URL before storing it in element data.
    url?: string;
}
