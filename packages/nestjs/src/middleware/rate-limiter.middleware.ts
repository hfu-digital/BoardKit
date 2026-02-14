import { Injectable } from '@nestjs/common';

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

@Injectable()
export class RateLimiter {
    private buckets = new Map<string, TokenBucket>();
    private maxTokens = 120;
    private refillRatePerSec = 120;

    setRate(maxPerSec: number): void {
        this.maxTokens = maxPerSec;
        this.refillRatePerSec = maxPerSec;
    }

    checkLimit(userId: string, boardId: string): { allowed: boolean; retryAfterMs?: number } {
        const key = `${userId}:${boardId}`;
        const now = Date.now();

        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = { tokens: this.maxTokens, lastRefill: now };
            this.buckets.set(key, bucket);
        }

        // Refill tokens
        const elapsed = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerSec);
        bucket.lastRefill = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true };
        }

        const retryAfterMs = Math.ceil((1 - bucket.tokens) / this.refillRatePerSec * 1000);
        return { allowed: false, retryAfterMs };
    }
}
