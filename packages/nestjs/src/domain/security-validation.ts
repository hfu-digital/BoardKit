import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { validateElement } from '@hfu.digital/boardkit-core';
import type { ElementMutation } from '@hfu.digital/boardkit-core';

export function validateJson(value: unknown, depth = 0): void {
    if (depth > 20) throw new BadRequestException('Object too deep');
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e15)) throw new BadRequestException('Invalid number');
    if (typeof value === 'string' && value.length > 262144) throw new PayloadTooLargeException('String too long');
    if (Array.isArray(value) && value.length > 10000) throw new PayloadTooLargeException('Array too long');
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new BadRequestException('Invalid key');
            validateJson(child, depth + 1);
        }
    }
}

export function validateRenderable(el: any): void {
    validateJson(el);
    if (!validateElement(el).valid) throw new BadRequestException('Invalid element');
    const d = el.data;
    const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7;
    const point = (p: any) => p && number(p.x) && number(p.y);
    const size = (p: any) => p && number(p.width) && number(p.height) && p.width >= 0 && p.height >= 0;
    if (!point(d.bounds) || !size(d.bounds)) throw new BadRequestException('Invalid bounds');
    if (d.position && !point(d.position)) throw new BadRequestException('Invalid position');
    if (d.size && !size(d.size)) throw new BadRequestException('Invalid size');
    if (d.rotation !== undefined && !number(d.rotation)) throw new BadRequestException('Invalid rotation');
    if (d.points && (!Array.isArray(d.points) || !d.points.every(point))) throw new BadRequestException('Invalid points');
    const stroke = el.type === 'shape' ? d.style?.stroke : ['stroke', 'linear'].includes(el.type) ? d.style : null;
    if (stroke && (!number(stroke.width) || !number(stroke.opacity) ||
        !['round','butt','square'].includes(stroke.lineCap) || !['round','bevel','miter'].includes(stroke.lineJoin) ||
        typeof stroke.color !== 'string')) throw new BadRequestException('Invalid stroke');
    if (el.type === 'shape' && (!stroke || !d.style.fill || typeof d.style.fill.color !== 'string' || !number(d.style.fill.opacity) || (d.style.cornerRadius !== undefined && !number(d.style.cornerRadius)))) throw new BadRequestException('Invalid shape style');
    if (el.type === 'text' && (!number(d.style.fontSize) || !['normal','bold'].includes(d.style.fontWeight) ||
        typeof d.style.fontFamily !== 'string' || typeof d.style.color !== 'string')) throw new BadRequestException('Invalid text style');
    if (el.type === 'group' && !d.childIds.every((id: unknown) => typeof id === 'string')) throw new BadRequestException('Invalid group');
}

export function validateMutations(mutations: ElementMutation[], userId: string): void {
    if (!Array.isArray(mutations) || mutations.length === 0 || mutations.length > 200) throw new PayloadTooLargeException('Batch limit is 200');
    validateJson(mutations);
    if (Buffer.byteLength(JSON.stringify(mutations)) > 1024 * 1024) throw new PayloadTooLargeException('Batch exceeds 1 MiB');
    for (const m of mutations) {
        if (!m || !['create','update','delete'].includes(m.type) || typeof m.elementId !== 'string' || !m.elementId || m.elementId.length > 200 ||
            typeof m.pageId !== 'string' || !m.pageId || m.pageId.length > 200 || !Number.isFinite(m.timestamp)) throw new BadRequestException('Invalid mutation');
        if (m.type !== 'delete') {
            const el = m.data as any;
            if (!el || el.id !== m.elementId || el.pageId !== m.pageId) throw new BadRequestException('Mismatched element identity');
            // Neither wire payloads nor logs may claim another authenticated author.
            el.createdBy = userId;
            validateRenderable(el);
        }
    }
}
