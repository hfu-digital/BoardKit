import type { Element, LinearElement, Point } from '@hfu.digital/boardkit-core';
import { group, line, shape, text } from './elements';

export type GateKind = 'INPUT' | 'OUTPUT' | 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';
export interface CircuitPort { elementId: string; gateId: string; direction: 'input' | 'output'; index: number; position: Point }
const gateKinds: GateKind[] = ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'];
export function gateInputCount(kind: GateKind): number { return kind === 'INPUT' ? 0 : kind === 'NOT' || kind === 'OUTPUT' ? 1 : 2; }
export function evaluateGate(kind: GateKind, inputs: boolean[]): boolean {
    const [a = false, b = false] = inputs;
    switch (kind) {
        case 'INPUT': case 'OUTPUT': return a;
        case 'AND': return a && b;
        case 'NAND': return !(a && b);
        case 'OR': return a || b;
        case 'NOR': return !(a || b);
        case 'NOT': return !a;
        case 'XOR': return a !== b;
        case 'XNOR': return a === b;
    }
}

export function createGate(pageId: string, userId: string, x: number, y: number, kind: GateKind): Element[] {
    if (!gateKinds.includes(kind)) throw new Error('Unknown logic gate.');
    const body = shape(pageId, userId, x, y, 120, 80);
    body.data.style.cornerRadius = kind === 'INPUT' || kind === 'OUTPUT' ? 24 : 8;
    body.data.style.fill.color = '#eef2ff'; body.data.style.fill.type = 'solid';
    body.data.specialized = { kind: 'gate', gateType: kind, value: false };
    const label = text(pageId, userId, x + 15, y + 25, kind === 'INPUT' ? 'INPUT 0' : kind, 100);
    label.data.specialized = { kind: 'gate-label', gateId: body.id };
    const elements: Element[] = [body, label];
    const port = (direction: 'input' | 'output', index: number, px: number, py: number) => {
        const circle = shape(pageId, userId, px - 5, py - 5, 10, 10, 'ellipse');
        circle.data.style.fill = { type: 'solid', color: direction === 'input' ? '#6366f1' : '#9b2d9b', opacity: 1 };
        circle.data.specialized = { kind: 'port', gateId: body.id, direction, index };
        elements.push(circle);
    };
    const inputCount = gateInputCount(kind);
    for (let i = 0; i < inputCount; i++) port('input', i, x, y + (i + 1) * 80 / (inputCount + 1));
    if (kind !== 'OUTPUT') port('output', 0, x + 120, y + 40);
    return [...elements, group(elements)];
}

export function getGatePorts(elements: Element[], gateId: string): CircuitPort[] {
    return elements.flatMap(el => {
        const m = el.data.specialized;
        if (el.type !== 'shape' || m?.kind !== 'port' || m.gateId !== gateId) return [];
        return [{ elementId: el.id, gateId, direction: m.direction as 'input' | 'output', index: Number(m.index),
            position: { x: el.data.position.x + el.data.size.width / 2, y: el.data.position.y + el.data.size.height / 2 } }];
    });
}

export function createCircuitWire(pageId: string, userId: string, from: CircuitPort, to: CircuitPort): LinearElement {
    if (from.direction === 'input' && to.direction === 'output') [from, to] = [to, from];
    if (from.direction !== 'output' || to.direction !== 'input') throw new Error('Connect an output port to an input port.');
    if (from.gateId === to.gateId) throw new Error('A gate cannot connect to itself.');
    const middle = (from.position.x + to.position.x) / 2;
    const wire = line(pageId, userId, [from.position, { x: middle, y: from.position.y }, { x: middle, y: to.position.y }, to.position]);
    wire.data.startBinding = { elementId: from.elementId }; wire.data.endBinding = { elementId: to.elementId };
    wire.data.specialized = { kind: 'circuit-wire', fromGate: from.gateId, toGate: to.gateId, toInput: to.index };
    return wire;
}

export function createTruthTable(pageId: string, userId: string, x: number, y: number, kind: GateKind): Element[] {
    const count = gateInputCount(kind);
    const rows = [`${Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)).join('   ')}  │  ${kind}`];
    for (let i = 0; i < 2 ** count; i++) {
        const inputs = Array.from({ length: count }, (_, j) => Boolean(i & (1 << (count - j - 1))));
        rows.push(`${inputs.map(Number).join('   ')}  │  ${Number(evaluateGate(kind, inputs))}`);
    }
    const result = text(pageId, userId, x, y, rows.join('\n'), 350);
    result.data.style.fontFamily = 'monospace';
    return [result];
}

interface Gate { id: string; kind: GateKind; value: boolean; label: string }
function circuitGraph(elements: Element[]) {
    const gates: Gate[] = elements.flatMap(el => {
        const m = el.data.specialized;
        if (m?.kind !== 'gate' || !gateKinds.includes(m.gateType as GateKind)) return [];
        return [{ id: el.id, kind: m.gateType as GateKind, value: Boolean(m.value), label: String(m.label ?? m.gateType) }];
    });
    const gateMap = new Map(gates.map(g => [g.id, g]));
    const incoming = new Map<string, Map<number, string>>();
    for (const el of elements) {
        const m = el.data.specialized;
        if (m?.kind !== 'circuit-wire') continue;
        const from = String(m.fromGate), to = String(m.toGate), index = Number(m.toInput);
        if (!gateMap.has(from) || !gateMap.has(to)) continue;
        const target = incoming.get(to) ?? new Map<number, string>();
        if (target.has(index)) throw new Error('Each input port accepts one wire. Remove duplicate wires.');
        target.set(index, from); incoming.set(to, target);
    }
    const evaluate = (id: string, inputs: Map<string, boolean>, visiting = new Set<string>()): boolean => {
        const gate = gateMap.get(id);
        if (!gate) throw new Error('A connected gate is missing.');
        if (visiting.has(id)) throw new Error('Circuit contains a feedback loop. Truth tables require combinational circuits.');
        if (gate.kind === 'INPUT') return inputs.get(id) ?? gate.value;
        const next = new Set(visiting).add(id);
        const values = Array.from({ length: gateInputCount(gate.kind) }, (_, index) => {
            const source = incoming.get(id)?.get(index);
            if (!source) throw new Error(`${gate.kind} has an unconnected input. Connect all ports first.`);
            return evaluate(source, inputs, next);
        });
        return evaluateGate(gate.kind, values);
    };
    return { gates, evaluate };
}

/** Computes live output states; the caller can display them beside the gate palette. */
export function evaluateCircuit(elements: Element[]): Map<string, boolean> {
    const { gates, evaluate } = circuitGraph(elements);
    const result = new Map<string, boolean>();
    for (const gate of gates) result.set(gate.id, evaluate(gate.id, new Map()));
    return result;
}

export function createCircuitTruthTable(pageId: string, userId: string, x: number, y: number, elements: Element[]): Element[] {
    const { gates, evaluate } = circuitGraph(elements);
    const inputs = gates.filter(g => g.kind === 'INPUT');
    const outputs = gates.filter(g => g.kind === 'OUTPUT');
    if (inputs.length === 0 || outputs.length === 0) throw new Error('Add INPUT and OUTPUT gates and connect the circuit first.');
    if (inputs.length > 8) throw new Error('Truth tables support at most eight inputs (256 rows).');
    const names = [...inputs.map((g, i) => `${g.label} ${i + 1}`), ...outputs.map((g, i) => `${g.label} ${i + 1}`)];
    const rows = [names.join(' │ ')];
    for (let i = 0; i < 2 ** inputs.length; i++) {
        const bits = inputs.map((_, j) => Boolean(i & (1 << (inputs.length - j - 1))));
        const values = new Map(inputs.map((g, j) => [g.id, bits[j]]));
        rows.push([...bits, ...outputs.map(g => evaluate(g.id, values))].map(v => String(Number(v))).join('          │ '));
    }
    // Split long tables so no text element exceeds practical canvas bounds.
    const result: Element[] = [];
    for (let start = 1, column = 0; start < rows.length; start += 32, column++) {
        const table = text(pageId, userId, x + column * Math.max(360, names.length * 130), y,
            [rows[0], ...rows.slice(start, start + 32)].join('\n'), Math.max(360, names.length * 130));
        table.data.style.fontFamily = 'monospace'; table.data.specialized = { kind: 'truth-table' };
        result.push(table);
    }
    return result;
}
