import { RATE_LIMIT } from './constants.js';

export class RateLimiter {
  private requestCount = 0;
  private readonly sessionSpeedMultiplier: number;
  private currentBatchSize: number;

  constructor() {
    this.sessionSpeedMultiplier =
      RATE_LIMIT.SESSION_SPEED_MIN +
      Math.random() * (RATE_LIMIT.SESSION_SPEED_MAX - RATE_LIMIT.SESSION_SPEED_MIN);

    this.currentBatchSize = Math.floor(
      RATE_LIMIT.BATCH_SIZE_MIN +
        Math.random() * (RATE_LIMIT.BATCH_SIZE_MAX - RATE_LIMIT.BATCH_SIZE_MIN + 1)
    );
  }

  async wait(): Promise<void> {
    const triangularJitter = ((Math.random() + Math.random()) / 2) * RATE_LIMIT.JITTER_MAX_MS;
    const baseDelay = (RATE_LIMIT.BASE_DELAY_MS + triangularJitter) * this.sessionSpeedMultiplier;

    this.requestCount++;

    let totalDelay = baseDelay;

    if (this.requestCount % this.currentBatchSize === 0) {
      totalDelay += RATE_LIMIT.BATCH_PAUSE_MS * this.sessionSpeedMultiplier;
      this.currentBatchSize = Math.floor(
        RATE_LIMIT.BATCH_SIZE_MIN +
          Math.random() * (RATE_LIMIT.BATCH_SIZE_MAX - RATE_LIMIT.BATCH_SIZE_MIN + 1)
      );
    }

    if (Math.random() < RATE_LIMIT.READING_PAUSE_CHANCE) {
      const readingPause =
        RATE_LIMIT.READING_PAUSE_MIN_MS +
        Math.random() * (RATE_LIMIT.READING_PAUSE_MAX_MS - RATE_LIMIT.READING_PAUSE_MIN_MS);
      totalDelay += readingPause * this.sessionSpeedMultiplier;
    }

    await new Promise((resolve) => setTimeout(resolve, totalDelay));
  }

  async backoff(attempt: number): Promise<void> {
    const exponentialDelay = RATE_LIMIT.BASE_DELAY_MS * Math.pow(RATE_LIMIT.BACKOFF_MULTIPLIER, attempt);
    const maxBackoff = 60000;
    const delay = Math.min(exponentialDelay, maxBackoff);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async honor429(retryAfterHeader: string | null): Promise<void> {
    let waitMs = RATE_LIMIT.BASE_DELAY_MS;

    if (retryAfterHeader) {
      const retryAfterSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfterSeconds)) {
        waitMs = retryAfterSeconds * 1000;
      }
    }

    const jitter = Math.random() * RATE_LIMIT.JITTER_MAX_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs + jitter));
  }

  reset(): void {
    this.requestCount = 0;
  }
}
