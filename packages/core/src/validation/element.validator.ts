import type { Element, ElementType } from '../types/elements';

const VALID_TYPES: ElementType[] = ['stroke', 'shape', 'linear', 'text', 'image', 'group'];

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateElement(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Element must be an object'] };
    }

    const el = data as Record<string, unknown>;

    if (typeof el.id !== 'string' || el.id.length === 0) {
        errors.push('Element must have a non-empty string id');
    }
    if (typeof el.pageId !== 'string' || el.pageId.length === 0) {
        errors.push('Element must have a non-empty string pageId');
    }
    if (!VALID_TYPES.includes(el.type as ElementType)) {
        errors.push(`Invalid element type: ${String(el.type)}. Must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (typeof el.zIndex !== 'number' || !Number.isFinite(el.zIndex)) {
        errors.push('Element must have a finite number zIndex');
    }
    if (typeof el.createdBy !== 'string' || el.createdBy.length === 0) {
        errors.push('Element must have a non-empty string createdBy');
    }
    if (!el.data || typeof el.data !== 'object') {
        errors.push('Element must have a data object');
    }

    if (errors.length === 0 && el.data && typeof el.data === 'object') {
        const d = el.data as Record<string, unknown>;
        switch (el.type) {
            case 'stroke':
                if (!Array.isArray(d.points)) errors.push('Stroke must have a points array');
                if (!d.style || typeof d.style !== 'object') errors.push('Stroke must have a style object');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Stroke must have a bounds object');
                break;
            case 'shape':
                if (
                    typeof d.shapeType !== 'string' ||
                    !['rectangle', 'diamond', 'ellipse'].includes(d.shapeType)
                ) {
                    errors.push("Shape must have shapeType 'rectangle' | 'diamond' | 'ellipse'");
                }
                if (!d.position || typeof d.position !== 'object') errors.push('Shape must have a position');
                if (!d.size || typeof d.size !== 'object') errors.push('Shape must have a size');
                if (typeof d.rotation !== 'number') errors.push('Shape must have a rotation number');
                if (!d.style || typeof d.style !== 'object') errors.push('Shape must have a style object');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Shape must have a bounds object');
                break;
            case 'linear':
                if (
                    typeof d.linearType !== 'string' ||
                    !['line', 'arrow'].includes(d.linearType)
                ) {
                    errors.push("Linear must have linearType 'line' | 'arrow'");
                }
                if (!Array.isArray(d.points) || d.points.length < 2) {
                    errors.push('Linear must have a points array with at least 2 entries');
                }
                if (typeof d.rotation !== 'number') errors.push('Linear must have a rotation number');
                if (!d.style || typeof d.style !== 'object') errors.push('Linear must have a style object');
                if (typeof d.arrowStart !== 'boolean') errors.push('Linear must have arrowStart boolean');
                if (typeof d.arrowEnd !== 'boolean') errors.push('Linear must have arrowEnd boolean');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Linear must have a bounds object');
                break;
            case 'text':
                if (typeof d.content !== 'string') errors.push('Text must have a content string');
                if (!d.position || typeof d.position !== 'object') errors.push('Text must have a position');
                if (!d.size || typeof d.size !== 'object') errors.push('Text must have a size');
                if (typeof d.rotation !== 'number') errors.push('Text must have a rotation number');
                if (!d.style || typeof d.style !== 'object') errors.push('Text must have a style object');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Text must have a bounds object');
                break;
            case 'image':
                if (typeof d.assetId !== 'string') errors.push('Image must have an assetId string');
                if (typeof d.url !== 'string') errors.push('Image must have a url string');
                if (!d.position || typeof d.position !== 'object') errors.push('Image must have a position');
                if (!d.size || typeof d.size !== 'object') errors.push('Image must have a size');
                if (typeof d.rotation !== 'number') errors.push('Image must have a rotation number');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Image must have a bounds object');
                break;
            case 'group':
                if (!Array.isArray(d.childIds)) errors.push('Group must have a childIds array');
                if (!d.bounds || typeof d.bounds !== 'object') errors.push('Group must have a bounds object');
                break;
        }
    }

    return { valid: errors.length === 0, errors };
}
