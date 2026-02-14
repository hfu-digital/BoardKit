import {
    BoardAuthGuard,
    type AuthenticatedUser,
} from '../interfaces/auth-guard.interface';

export class MockAuthGuard extends BoardAuthGuard {
    async validateConnection(
        token: string,
    ): Promise<AuthenticatedUser | null> {
        if (!token) return null;
        return {
            userId: token,
            displayName: `User ${token}`,
        };
    }

    async validateRequest(
        token: string,
    ): Promise<AuthenticatedUser | null> {
        if (!token) return null;
        return {
            userId: token,
            displayName: `User ${token}`,
        };
    }
}
