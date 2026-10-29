import type { Element, Point } from '@hfu.digital/boardkit-core';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { group, image, line, text } from './elements';

/** A self-contained SVG with glyph paths: no fonts, foreignObject, or network requests. */
export function createEquation(pageId: string, userId: string, x: number, y: number, latex: string): Element[] {
    if (!latex.trim() || latex.length > 4000) throw new Error('Enter an equation of at most 4,000 characters.');
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const document = mathjax.document('', {
        InputJax: new TeX({ packages: AllPackages.filter(p => !['html', 'require', 'autoload'].includes(p)),
            maxBuffer: 8000, maxMacros: 1000,
            formatError: (_jax: unknown, error: { message: string }) => { throw new Error(error.message); } }),
        OutputJax: new SVG({ fontCache: 'none' }),
    });
    const node = document.convert(latex, { display: true, em: 24, ex: 12, containerWidth: 1000 });
    const svgNode = adaptor.firstChild(node)! as LiteElement;
    const svg = adaptor.outerHTML(svgNode);
    const viewBox = adaptor.getAttribute(svgNode, 'viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 1000, 1000];
    const width = Math.min(1200, Math.max(40, viewBox[2] * 0.024));
    const height = Math.max(32, width * viewBox[3] / viewBox[2]);
    const result = image(pageId, userId, x, y, width, height,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/currentColor/g, '#222222'))}`, '');
    result.data.specialized = { kind: 'equation', latex };
    return [result];
}

type Expr = { type: 'number'; value: number } | { type: 'variable' } |
    { type: 'unary'; op: string; arg: Expr } | { type: 'binary'; op: string; left: Expr; right: Expr };
const functions: Record<string, (x: number) => number> = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
    atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, log: Math.log, ln: Math.log,
    log10: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round,
};

/** Deliberately small mathematical grammar. Never evaluates JavaScript. */
export function compileFunction(source: string): (x: number) => number {
    if (!source.trim() || source.length > 500) throw new Error('Enter a function of at most 500 characters.');
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z]+|[^\s]/g) ?? [];
    let position = 0;
    const parse = (min: number, depth = 0): Expr => {
        if (depth > 64) throw new Error('Expression is nested too deeply.');
        const token = tokens[position++];
        let left: Expr;
        if (token === '+' || token === '-') left = { type: 'unary', op: token, arg: parse(25, depth + 1) };
        else if (token === '(') {
            left = parse(0, depth + 1);
            if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis.');
        } else if (token === 'x') left = { type: 'variable' };
        else if (token === 'pi' || token === 'e') left = { type: 'number', value: token === 'pi' ? Math.PI : Math.E };
        else if (token && Object.hasOwn(functions, token)) {
            if (tokens[position++] !== '(') throw new Error(`Use ${token}(x).`);
            const arg = parse(0, depth + 1);
            if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis.');
            left = { type: 'unary', op: token, arg };
        } else if (token && /^\d|^\.\d/.test(token)) left = { type: 'number', value: Number(token) };
        else throw new Error(`Unexpected symbol: ${token ?? 'end of expression'}.`);
        while (position < tokens.length) {
            const op = tokens[position];
            const precedence = op === '+' || op === '-' ? 10 : op === '*' || op === '/' ? 20 : op === '^' ? 30 : -1;
            if (precedence < min) break;
            position++;
            left = { type: 'binary', op, left, right: parse(op === '^' ? precedence : precedence + 1, depth + 1) };
        }
        return left;
    };
    const root = parse(0);
    if (position !== tokens.length) throw new Error(`Unexpected symbol: ${tokens[position]}. Use * for multiplication.`);
    const evaluate = (node: Expr, x: number): number => {
        if (node.type === 'number') return node.value;
        if (node.type === 'variable') return x;
        if (node.type === 'unary') {
            const a = evaluate(node.arg, x);
            return node.op === '+' ? a : node.op === '-' ? -a : functions[node.op](a);
        }
        const a = evaluate(node.left, x), b = evaluate(node.right, x);
        return node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : node.op === '/' ? a / b : a ** b;
    };
    return x => evaluate(root, x);
}

export interface PlotOptions { minX?: number; maxX?: number; minY?: number; maxY?: number; width?: number; height?: number }
export function createFunctionPlot(pageId: string, userId: string, x: number, y: number, expression: string, options: PlotOptions = {}): Element[] {
    const { minX = -10, maxX = 10, minY = -10, maxY = 10, width = 600, height = 400 } = options;
    if (![minX, maxX, minY, maxY, width, height].every(Number.isFinite) || minX >= maxX || minY >= maxY || width < 100 || height < 100 || width > 2000 || height > 2000)
        throw new Error('Use increasing finite axis ranges and plot dimensions from 100 to 2,000.');
    const f = compileFunction(expression);
    const sx = (v: number) => x + (v - minX) / (maxX - minX) * width;
    const sy = (v: number) => y + height - (v - minY) / (maxY - minY) * height;
    const elements: Element[] = [];
    for (let i = 0; i <= 10; i++) {
        for (const points of [[{ x: x + i * width / 10, y }, { x: x + i * width / 10, y: y + height }],
            [{ x, y: y + i * height / 10 }, { x: x + width, y: y + i * height / 10 }]]) {
            const gridline = line(pageId, userId, points); gridline.data.style.color = '#dddddd'; gridline.data.style.width = 1; elements.push(gridline);
        }
    }
    if (minX <= 0 && maxX >= 0) elements.push(line(pageId, userId, [{ x: sx(0), y }, { x: sx(0), y: y + height }], true));
    if (minY <= 0 && maxY >= 0) elements.push(line(pageId, userId, [{ x, y: sy(0) }, { x: x + width, y: sy(0) }], true));
    elements.push(text(pageId, userId, x, y - 40, `y = ${expression}`, width),
        text(pageId, userId, x, y + height + 8, `${minX} ≤ x ≤ ${maxX}    ${minY} ≤ y ≤ ${maxY}`, width));
    let points: Point[] = [];
    const flush = () => {
        if (points.length >= 2) {
            const curve = line(pageId, userId, points);
            curve.data.style.color = '#9b2d9b'; curve.data.style.width = 2;
            curve.data.specialized = { kind: 'function-plot', expression, minX, maxX, minY, maxY };
            elements.push(curve);
        }
        points = [];
    };
    for (let i = 0; i <= 800; i++) {
        const xv = minX + i / 800 * (maxX - minX), value = f(xv);
        const point = { x: sx(xv), y: sy(value) };
        if (!Number.isFinite(value) || value < minY || value > maxY) { flush(); continue; }
        if (points.length && Math.abs(point.y - points[points.length - 1].y) > height / 3) flush();
        points.push(point);
    }
    flush();
    return [...elements, group(elements)];
}
