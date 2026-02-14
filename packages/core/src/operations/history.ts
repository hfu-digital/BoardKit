import type { ElementMutation } from '../types/events';

export interface Command {
    execute(): ElementMutation[];
    undo(): ElementMutation[];
}

export class History {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    constructor(private maxDepth: number = 100) {}

    push(command: Command): void {
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxDepth) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo(): ElementMutation[] | null {
        const command = this.undoStack.pop();
        if (!command) return null;
        this.redoStack.push(command);
        return command.undo();
    }

    redo(): ElementMutation[] | null {
        const command = this.redoStack.pop();
        if (!command) return null;
        this.undoStack.push(command);
        return command.execute();
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
