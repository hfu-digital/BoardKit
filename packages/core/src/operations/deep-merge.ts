/**
 * Deep-merge patch that avoids stomping nested objects (e.g. updating only
 * stroke.color on style.stroke must not erase fill). One level of recursion
 * is enough for our element data shape.
 */
export function deepMerge<T>(target: T, patch: Partial<T>): T {
    if (!patch || typeof patch !== 'object') return target;
    const out = { ...target } as T;
    for (const key of Object.keys(patch) as Array<keyof T>) {
        const tv = (target as Record<string, unknown>)[key as string];
        const pv = (patch as Record<string, unknown>)[key as string];
        if (
            tv && typeof tv === 'object' && !Array.isArray(tv) &&
            pv && typeof pv === 'object' && !Array.isArray(pv)
        ) {
            (out as Record<string, unknown>)[key as string] = deepMerge(tv, pv as Partial<typeof tv>);
        } else if (pv !== undefined) {
            (out as Record<string, unknown>)[key as string] = pv;
        }
    }
    return out;
}
