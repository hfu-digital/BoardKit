import { Injectable } from '@nestjs/common';
import { LIMITS } from '@hfu.digital/boardkit-core';

export interface SizeGuardLimits {
    maxElementsPerPage: number;
    maxPagesPerBoard: number;
}

@Injectable()
export class SizeGuard {
    private limits: SizeGuardLimits;

    constructor(limits?: Partial<SizeGuardLimits>) {
        this.limits = {
            maxElementsPerPage: limits?.maxElementsPerPage ?? LIMITS.MAX_ELEMENTS_PER_PAGE,
            maxPagesPerBoard: limits?.maxPagesPerBoard ?? LIMITS.MAX_PAGES_PER_BOARD,
        };
    }

    checkElementLimit(currentCount: number, addCount: number): { allowed: boolean; error?: string } {
        const total = currentCount + addCount;
        if (total > this.limits.maxElementsPerPage) {
            return {
                allowed: false,
                error: `Element count ${total} would exceed limit of ${this.limits.maxElementsPerPage} per page`,
            };
        }
        return { allowed: true };
    }

    checkPageLimit(currentCount: number): { allowed: boolean; error?: string } {
        if (currentCount >= this.limits.maxPagesPerBoard) {
            return {
                allowed: false,
                error: `Page count ${currentCount} has reached limit of ${this.limits.maxPagesPerBoard} per board`,
            };
        }
        return { allowed: true };
    }
}
