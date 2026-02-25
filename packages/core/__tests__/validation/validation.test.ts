import { describe, it, expect } from 'vitest';
import { validateElement } from '../../src/validation/element.validator';
import { validateBoardLimits, validateAssetSize } from '../../src/validation/board.validator';
import { DEFAULT_STROKE_STYLE, DEFAULT_TEXT_STYLE, DEFAULT_FILL_STYLE } from '../../src/constants';

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

    it('accepts connector type', () => {
        const connector = {
            id: 'conn-1',
            pageId: 'page-1',
            type: 'connector',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                startElementId: 'el-1',
                endElementId: 'el-2',
                startAnchor: 'right',
                endAnchor: 'left',
                waypoints: [],
                style: { ...DEFAULT_STROKE_STYLE },
                arrowStart: false,
                arrowEnd: true,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
            },
        };
        const result = validateElement(connector);
        expect(result.valid).toBe(true);
    });

    it('validates shape-specific fields', () => {
        const shape = {
            id: 'sh-1',
            pageId: 'page-1',
            type: 'shape',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                shapeType: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 80 },
                rotation: 0,
                style: { stroke: { ...DEFAULT_STROKE_STYLE }, fill: { ...DEFAULT_FILL_STYLE } },
                bounds: { x: 0, y: 0, width: 100, height: 80 },
            },
        };
        expect(validateElement(shape).valid).toBe(true);
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

    it('validates stickyNote-specific fields', () => {
        const note = {
            id: 'sn-1',
            pageId: 'page-1',
            type: 'stickyNote',
            zIndex: 0,
            createdBy: 'user-1',
            data: {
                content: 'Note',
                position: { x: 0, y: 0 },
                size: { width: 200, height: 200 },
                color: '#FFEAA7',
                style: { ...DEFAULT_TEXT_STYLE },
                bounds: { x: 0, y: 0, width: 200, height: 200 },
            },
        };
        expect(validateElement(note).valid).toBe(true);
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
