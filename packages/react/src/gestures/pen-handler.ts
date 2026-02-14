export interface PenInfo {
    pressure: number;
    tiltX: number;
    tiltY: number;
    isBarrelButton: boolean;
}

export class PenHandler {
    private isBarrelDown = false;

    handlePenDown(button: number): void {
        if (button === 5) {
            this.isBarrelDown = true;
        }
    }

    handlePenUp(button: number): void {
        if (button === 5) {
            this.isBarrelDown = false;
        }
    }

    isBarrelButtonDown(): boolean {
        return this.isBarrelDown;
    }

    extractPenInfo(e: PointerEvent): PenInfo {
        return {
            pressure: e.pressure,
            tiltX: e.tiltX,
            tiltY: e.tiltY,
            isBarrelButton: this.isBarrelDown,
        };
    }
}
