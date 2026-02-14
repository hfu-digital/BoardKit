/**
 * Maps pen pressure to stroke width.
 * @param pressure - Raw pressure value (0-1)
 * @param baseWidth - Base stroke width in pixels
 * @param minMultiplier - Minimum width multiplier. Default: 0.3
 * @param maxMultiplier - Maximum width multiplier. Default: 1.5
 */
export function pressureToWidth(
    pressure: number,
    baseWidth: number,
    minMultiplier = 0.3,
    maxMultiplier = 1.5,
): number {
    const clampedPressure = Math.max(0, Math.min(1, pressure));
    const multiplier =
        minMultiplier + clampedPressure * (maxMultiplier - minMultiplier);
    return baseWidth * multiplier;
}
