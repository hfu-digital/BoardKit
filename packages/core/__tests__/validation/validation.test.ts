import { describe, it, expect } from 'vitest';
import { validateElement } from '../../src/validation/element.validator';
import { validateBoardLimits, validateAssetSize } from '../../src/validation/board.validator';
import { DEFAULT_STROKE_STYLE, DEFAULT_TEXT_STYLE, DEFAULT_SHAPE_STYLE } from '../../src/constants';

describe('validateElement', () => {
    const validStroke = {
        id: 'el-1',
        pageId: 'page-1',
        type: 'stroke',
        zIndex: 0,
        createdBy: 'user-1',
        data: {
            points: [{ x: 0, y: 0 }],
            style: { ...DEFAULT_STROKE_STYLE },
            bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
    };

    it('validates a correct stroke element', () => {
        const result = validateElement(validStroke);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects null/undefined', () => {
        expect(validateElement(null).valid).toBe(false);
        expect(validateElement(undefined).valid).toBe(false);
    });

    it('rejects missing id', () => {
        const { id, ...rest } = validStroke;
        const result = validateElement(rest);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('rejects invalid element type', () => {
        const result = validateElement({ ...validStroke, type: 'invalid' });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Invalid element type'))).toBe(true);
    });

    it('rejects dropped legacy types (stickyNote / connector)', () => {
        const sticky = { ...validStroke, type: 'stickyNote' };
        const connector = { ...validStroke, type: 'connector' };
        expect(validateElement(sticky).valid).toBe(false);
        expect(validateElement(connector).valid).toBe(false);
    });

    it('validates rectangle/diamond/ellipse shape types', () => {
        for (const shapeType of ['rectangle', 'diamond', 'ellipse'] as const) {
            const shape = {
                id: `sh-${shapeType}`,
                pageId: 'page-1',
                type: 'shape',
                zIndex: 0,
                createdBy: 'user-1',
                data: {
                    shapeType,
                    position: { x: 0, y: 0 },
                    size: { width: 100, height: 80 },
                    rotation: 0,
                    style: { ...DEFAULT_SHAPE_STYLE },
                    bounds: { x: 0, y: 0, width: 100, height: 80 },
                },
            };
            expect(validateElement(shape).valid).toBe(true);
        }
    });

    it('rejects unknown shape sub-types', () => {
        const shape = {
            id: 'sh-bad',
            pageId: 'page-1',
            type: 'shape',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                shapeType: 'triangle',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 80 },
                rotation: 0,
                style: { ...DEFAULT_SHAPE_STYLE },
                bounds: { x: 0, y: 0, width: 100, height: 80 },
            },
        };
        expect(validateElement(shape).valid).toBe(false);
    });

    it('validates linear (line + arrow)', () => {
        for (const linearType of ['line', 'arrow'] as const) {
            const linear = {
                id: `ln-${linearType}`,
                pageId: 'page-1',
                type: 'linear',
                zIndex: 0,
                createdBy: 'user-1',
                data: {
                    linearType,
                    points: [{ x: 0, y: 0 }, { x: 100, y: 50 }],
                    rotation: 0,
                    style: { ...DEFAULT_STROKE_STYLE },
                    roughness: 1,
                    seed: 42,
                    arrowStart: false,
                    arrowEnd: linearType === 'arrow',
                    bounds: { x: 0, y: 0, width: 100, height: 50 },
                },
            };
            expect(validateElement(linear).valid).toBe(true);
        }
    });

    it('rejects linear with fewer than 2 points', () => {
        const linear = {
            id: 'ln-bad',
            pageId: 'page-1',
            type: 'linear',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                linearType: 'line',
                points: [{ x: 0, y: 0 }],
                rotation: 0,
                style: { ...DEFAULT_STROKE_STYLE },
                roughness: 1,
                seed: 42,
                arrowStart: false,
                arrowEnd: false,
                bounds: { x: 0, y: 0, width: 0, height: 0 },
            },
        };
        expect(validateElement(linear).valid).toBe(false);
    });

    it('validates text-specific fields', () => {
        const text = {
            id: 'txt-1',
            pageId: 'page-1',
            type: 'text',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                content: 'Hello',
                position: { x: 0, y: 0 },
                size: { width: 200, height: 40 },
                rotation: 0,
                style: { ...DEFAULT_TEXT_STYLE },
                bounds: { x: 0, y: 0, width: 200, height: 40 },
            },
        };
        expect(validateElement(text).valid).toBe(true);
    });

    it('validates group-specific fields', () => {
        const group = {
            id: 'grp-1',
            pageId: 'page-1',
            type: 'group',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                childIds: ['el-1', 'el-2'],
                bounds: { x: 0, y: 0, width: 200, height: 200 },
            },
        };
        expect(validateElement(group).valid).toBe(true);
    });

    it('rejects stroke missing points', () => {
        const bad = {
            ...validStroke,
            data: { style: { ...DEFAULT_STROKE_STYLE }, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        };
        const result = validateElement(bad);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('points'))).toBe(true);
    });
});

describe('validateBoardLimits', () => {
    it('passes for valid counts', () => {
        const result = validateBoardLimits(100, 5);
        expect(result.valid).toBe(true);
    });

    it('fails when element count exceeds limit', () => {
        const result = validateBoardLimits(20000, 5);
        expect(result.valid).toBe(false);
    });

    it('fails when page count exceeds limit', () => {
        const result = validateBoardLimits(100, 200);
        expect(result.valid).toBe(false);
    });

    it('accepts custom limits', () => {
        const result = validateBoardLimits(50, 5, { maxElementsPerPage: 10 });
        expect(result.valid).toBe(false);
    });
});

describe('validateAssetSize', () => {
    it('passes for small file', () => {
        expect(validateAssetSize(1024).valid).toBe(true);
    });

    it('fails for oversized file', () => {
        const thirtyMb = 30 * 1024 * 1024;
        expect(validateAssetSize(thirtyMb).valid).toBe(false);
    });

    it('accepts custom limit', () => {
        const fiveMb = 5 * 1024 * 1024;
        expect(validateAssetSize(fiveMb, { maxAssetSizeMb: 1 }).valid).toBe(false);
    });
});
