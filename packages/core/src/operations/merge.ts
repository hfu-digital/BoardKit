import type { Element } from '../types/elements';
import type { ElementMutation } from '../types/events';
import type { SceneState } from '../scene/scene-graph';
import { addElement, removeElement, updateElement } from '../scene/scene-graph';

/**
 * Last-Writer-Wins merge for a single element.
 * Compares updatedAt timestamps; if equal, remote wins (server authority).
 */
export function mergeElement(local: Element, remote: Element): Element {
    if (local.updatedAt > remote.updatedAt) {
        return local;
    }
    return remote;
}

/**
 * Apply remote mutations to local scene using LWW per element.
 */
export function mergeScene(
    local: SceneState,
    remote: ElementMutation[],
): SceneState {
    let scene = local;

    for (const mutation of remote) {
        switch (mutation.type) {
            case 'create': {
                if (mutation.data) {
                    const existing = scene.elements.get(mutation.elementId);
                    if (existing) {
                        // Element already exists — LWW merge
                        const remoteEl = {
                            ...existing,
                            ...mutation.data,
                            id: mutation.elementId,
                        } as Element;
                        const winner = mergeElement(existing, remoteEl);
                        if (winner !== existing) {
                            scene = updateElement(
                                scene,
                                mutation.elementId,
                                mutation.data,
                            );
                        }
                    } else {
                        scene = addElement(scene, {
                            ...mutation.data,
                            id: mutation.elementId,
                            pageId: mutation.pageId,
                        } as Element);
                    }
                }
                break;
            }
            case 'update': {
                if (mutation.data) {
                    const existing = scene.elements.get(mutation.elementId);
                    if (existing) {
                        const remoteEl = {
                            ...existing,
                            ...mutation.data,
                            id: mutation.elementId,
                        } as Element;
                        const winner = mergeElement(existing, remoteEl);
                        if (winner !== existing) {
                            scene = updateElement(
                                scene,
                                mutation.elementId,
                                mutation.data,
                            );
                        }
                    }
                }
                break;
            }
            case 'delete': {
                scene = removeElement(scene, mutation.elementId);
                break;
            }
        }
    }

    return scene;
}
