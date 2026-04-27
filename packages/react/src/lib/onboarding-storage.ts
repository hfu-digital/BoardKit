const KEY = 'bk-onboarding:v1';

export function isOnboardingCompleted(): boolean {
    try {
        return localStorage.getItem(KEY) === 'true';
    } catch {
        return false;
    }
}

export function markOnboardingCompleted(): void {
    try {
        localStorage.setItem(KEY, 'true');
    } catch {
        // sandboxed contexts (data: pages, certain iframes) don't have storage; non-fatal.
    }
}

export function resetOnboarding(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // see above
    }
}
