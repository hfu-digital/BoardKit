export interface AuthenticatedUser {
    userId: string;
    displayName: string;
}

export abstract class BoardAuthGuard {
    abstract validateConnection(
        token: string,
    ): Promise<AuthenticatedUser | null>;
    abstract validateRequest(
        token: string,
    ): Promise<AuthenticatedUser | null>;
}
