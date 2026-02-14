import { LIMITS } from '../constants';

export interface Limits {
    maxElementsPerPage: number;
    maxPagesPerBoard: number;
    maxAssetSizeMb: number;
    maxBoardSizeMb: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateBoardLimits(
    elementCount: number,
    pageCount: number,
    limits: Partial<Limits> = {},
): ValidationResult {
    const errors: string[] = [];

    const maxElements = limits.maxElementsPerPage ?? LIMITS.MAX_ELEMENTS_PER_PAGE;
    const maxPages = limits.maxPagesPerBoard ?? LIMITS.MAX_PAGES_PER_BOARD;

    if (elementCount > maxElements) {
        errors.push(`Element count ${elementCount} exceeds maximum ${maxElements} per page`);
    }

    if (pageCount > maxPages) {
        errors.push(`Page count ${pageCount} exceeds maximum ${maxPages} per board`);
    }

    return { valid: errors.length === 0, errors };
}

export function validateAssetSize(
    sizeBytes: number,
    limits: Partial<Limits> = {},
): ValidationResult {
    const errors: string[] = [];
    const maxSizeMb = limits.maxAssetSizeMb ?? LIMITS.MAX_ASSET_SIZE_MB;
    const sizeMb = sizeBytes / (1024 * 1024);

    if (sizeMb > maxSizeMb) {
        errors.push(`Asset size ${sizeMb.toFixed(2)}MB exceeds maximum ${maxSizeMb}MB`);
    }

    return { valid: errors.length === 0, errors };
}
