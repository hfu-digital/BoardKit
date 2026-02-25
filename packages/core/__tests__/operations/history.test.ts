import { describe, it, expect } from 'vitest';
import { History } from '../../src/operations/history';
import type { Command } from '../../src/operations/history';
import type { ElementMutation } from '../../src/types/events';

function makeCommand(label: string): Command {
    const executeMutations: ElementMutation[] = [{
        type: 'create',
        elementId: label,
        pageId: 'p1',
        timestamp: '2024-01-01T00:00:00Z',
    }];
    const undoMutations: ElementMutation[] = [{
        type: 'delete',
        elementId: label,
        pageId: 'p1',
        timestamp: '2024-01-01T00:00:00Z',
    }];
    return {
        execute: () => executeMutations,
        undo: () => undoMutations,
    };
}

describe('History', () => {
    it('starts with no undo/redo available', () => {
        const history = new History();
        expect(history.canUndo()).toBe(false);
        expect(history.canRedo()).toBe(false);
    });

    it('can undo after pushing a command', () => {
        const history = new History();
        history.push(makeCommand('a'));
        expect(history.canUndo()).toBe(true);
        const mutations = history.undo();
        expect(mutations).not.toBeNull();
        expect(mutations![0].type).toBe('delete');
    });

    it('can redo after undo', () => {
        const history = new History();
        history.push(makeCommand('a'));
        history.undo();
        expect(history.canRedo()).toBe(true);
        const mutations = history.redo();
        expect(mutations).not.toBeNull();
        expect(mutations![0].type).toBe('create');
    });

    it('clears redo stack on new push', () => {
        const history = new History();
        history.push(makeCommand('a'));
        history.undo();
        expect(history.canRedo()).toBe(true);
        history.push(makeCommand('b'));
        expect(history.canRedo()).toBe(false);
    });

    it('respects maxDepth', () => {
        const history = new History(3);
        history.push(makeCommand('a'));
        history.push(makeCommand('b'));
        history.push(makeCommand('c'));
        history.push(makeCommand('d'));
        // Only 3 commands should remain
        let count = 0;
        while (history.canUndo()) {
            history.undo();
            count++;
        }
        expect(count).toBe(3);
    });

    it('clear empties both stacks', () => {
        const history = new History();
        history.push(makeCommand('a'));
        history.undo();
        history.clear();
        expect(history.canUndo()).toBe(false);
        expect(history.canRedo()).toBe(false);
    });

    it('returns null when undo/redo is not available', () => {
        const history = new History();
        expect(history.undo()).toBeNull();
        expect(history.redo()).toBeNull();
    });
});
