import type { SceneState } from './scene-graph';

export function bringToFront(scene: SceneState, id: string): SceneState {
    if (!scene.elements.has(id)) return scene;
    const elementOrder = scene.elementOrder.filter((eid) => eid !== id);
    elementOrder.push(id);
    return { elements: scene.elements, elementOrder };
}

export function sendToBack(scene: SceneState, id: string): SceneState {
    if (!scene.elements.has(id)) return scene;
    const elementOrder = scene.elementOrder.filter((eid) => eid !== id);
    elementOrder.unshift(id);
    return { elements: scene.elements, elementOrder };
}

export function bringForward(scene: SceneState, id: string): SceneState {
    const idx = scene.elementOrder.indexOf(id);
    if (idx === -1 || idx === scene.elementOrder.length - 1) return scene;
    const elementOrder = [...scene.elementOrder];
    [elementOrder[idx], elementOrder[idx + 1]] = [elementOrder[idx + 1], elementOrder[idx]];
    return { elements: scene.elements, elementOrder };
}

export function sendBackward(scene: SceneState, id: string): SceneState {
    const idx = scene.elementOrder.indexOf(id);
    if (idx <= 0) return scene;
    const elementOrder = [...scene.elementOrder];
    [elementOrder[idx - 1], elementOrder[idx]] = [elementOrder[idx], elementOrder[idx - 1]];
    return { elements: scene.elements, elementOrder };
}

export function reorder(scene: SceneState, orderedIds: string[]): SceneState {
    // Only include IDs that exist in the scene
    const validIds = orderedIds.filter((id) => scene.elements.has(id));
    // Add any IDs that were not in orderedIds at the end
    const orderedSet = new Set(validIds);
    for (const id of scene.elementOrder) {
        if (!orderedSet.has(id)) validIds.push(id);
    }
    return { elements: scene.elements, elementOrder: validIds };
}
