import { describe, expect, it } from 'vitest';
import type { Element } from '@hfu.digital/boardkit-core';
import { compileFunction, createEquation, createFunctionPlot } from '../specialized/math';
import { createCircuitTruthTable, createCircuitWire, createGate, evaluateCircuit, evaluateGate, getGatePorts } from '../specialized/circuit';
import { createLecturePage } from '../specialized/lecture';

describe('mathematical functions', () => {
    it('uses mathematical precedence, constants, and right-associative powers', () => {
        expect(compileFunction('-2^2 + 2^3^2')(0)).toBe(508);
        expect(compileFunction('sin(pi / 2) + sqrt(x^2)')(-3)).toBeCloseTo(4);
        expect(compileFunction('1e-3*x')(1000)).toBe(1);
    });
    it('rejects executable code and malformed expressions', () => {
        for (const source of ['globalThis.process.exit()', 'constructor(1)', 'x;alert(1)', '2x', 'sin(x', ''])
            expect(() => compileFunction(source)).toThrow();
    });
    it('splits discontinuities and rejects invalid ranges', () => {
        const plot = createFunctionPlot('page', 'user', 0, 0, '1/x');
        const curves = plot.filter(e => e.data.specialized?.kind === 'function-plot');
        expect(curves.length).toBe(2);
        expect(() => createFunctionPlot('page', 'user', 0, 0, 'x', { minX: 2, maxX: 1 })).toThrow();
        for (const curve of curves) if (curve.type === 'linear')
            expect(curve.data.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    });
    it('renders portable SVG glyphs and preserves equation source', () => {
        const [equation] = createEquation('page', 'user', 10, 20, '\\frac{x^2}{2}');
        expect(equation.type).toBe('image');
        if (equation.type !== 'image') throw new Error('Expected image');
        const svg = decodeURIComponent(equation.data.url.split(',')[1]);
        expect(svg).toContain('<path');
        expect(svg).not.toContain('foreignObject');
        expect(equation.data.size.width).toBeGreaterThan(0);
        expect(equation.data.specialized?.latex).toBe('\\frac{x^2}{2}');
    });
});

function connect(elements: Element[], from: string, to: string, index = 0) {
    const source = getGatePorts(elements, from).find(p => p.direction === 'output')!;
    const target = getGatePorts(elements, to).find(p => p.direction === 'input' && p.index === index)!;
    elements.push(createCircuitWire('page', 'user', source, target));
}

describe('combinational circuits', () => {
    it('generates grouped gates with all ports and correct boolean semantics', () => {
        expect(createGate('page', 'user', 0, 0, 'AND').filter(e => e.data.specialized?.kind === 'port')).toHaveLength(3);
        expect(createGate('page', 'user', 0, 0, 'AND').at(-1)?.type).toBe('group');
        expect(evaluateGate('XOR', [true, true])).toBe(false);
        expect(evaluateGate('NAND', [true, false])).toBe(true);
        expect(evaluateGate('NOT', [true])).toBe(false);
    });
    it('evaluates connected networks and enumerates their truth tables', () => {
        const a = createGate('page', 'user', 0, 0, 'INPUT');
        const b = createGate('page', 'user', 0, 120, 'INPUT');
        const gate = createGate('page', 'user', 250, 0, 'AND');
        const out = createGate('page', 'user', 500, 0, 'OUTPUT');
        const elements = [...a, ...b, ...gate, ...out];
        a[0].data.specialized!.value = true;
        b[0].data.specialized!.value = true;
        connect(elements, a[0].id, gate[0].id); connect(elements, b[0].id, gate[0].id, 1);
        connect(elements, gate[0].id, out[0].id);
        expect(evaluateCircuit(elements).get(out[0].id)).toBe(true);
        const table = createCircuitTruthTable('page', 'user', 0, 0, elements)[0];
        expect(table.type === 'text' && table.data.content.split('\n')).toHaveLength(5);
        expect(table.type === 'text' && table.data.content.split('\n').at(-1)).toContain('1');
    });
    it('rejects missing, duplicate, and cyclic connections', () => {
        const a = createGate('page', 'user', 0, 0, 'NOT');
        const b = createGate('page', 'user', 200, 0, 'NOT');
        const elements = [...a, ...b];
        expect(() => evaluateCircuit(elements)).toThrow('unconnected');
        connect(elements, a[0].id, b[0].id); connect(elements, b[0].id, a[0].id);
        expect(() => evaluateCircuit(elements)).toThrow('feedback loop');
        connect(elements, a[0].id, b[0].id);
        expect(() => evaluateCircuit(elements)).toThrow('one wire');
    });
});

it('creates an A4 lecture frame with ruled writing space', () => {
    const page = createLecturePage('page', 'user', 40, 50);
    expect(page[0].data.bounds).toEqual({ x: 40, y: 50, width: 794, height: 1123 });
    expect(page.filter(e => e.type === 'linear').length).toBeGreaterThan(20);
});
