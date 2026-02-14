import type { Element } from '../types/elements';

export interface SceneState {
    elements: Map<string, Element>;
    elementOrder: string[]; // z-order sorted IDs
}

export function createScene(): SceneState {
    return { elements: new Map(), elementOrder: [] };
}

export function addElement(scene: SceneState, element: Element): SceneState {
    const elements = new Map(scene.elements);
    elements.set(element.id, element);
    const elementOrder = [...scene.elementOrder, element.id];
    return { elements, elementOrder };
}

export function removeElement(scene: SceneState, id: string): SceneState {
    const elements = new Map(scene.elements);
    elements.delete(id);
    const elementOrder = scene.elementOrder.filter((eid) => eid !== id);
    return { elements, elementOrder };
}

export function updateElement(scene: SceneState, id: string, patch: Partial<Element>): SceneState {
    const existing = scene.elements.get(id);
    if (!existing) return scene;
    const elements = new Map(scene.elements);
    elements.set(id, { ...existing, ...patch, id } as Element);
    return { elements, elementOrder: scene.elementOrder };
}

export function getElement(scene: SceneState, id: string): Element | undefined {
    return scene.elements.get(id);
}

export function getElementsByPage(scene: SceneState, pageId: string): Element[] {
    const result: Element[] = [];
    for (const id of scene.elementOrder) {
        const el = scene.elements.get(id);
        if (el && el.pageId === pageId) result.push(el);
    }
    return result;
}

export function loadElements(elements: Element[]): SceneState {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const map = new Map<string, Element>();
    const order: string[] = [];
    for (const el of sorted) {
        map.set(el.id, el);
        order.push(el.id);
    }
    return { elements: map, elementOrder: order };
}
