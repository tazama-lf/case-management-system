import { EventEmitter2 } from 'eventemitter2';
import { createHash } from 'crypto';

/**
 * Utility class to prevent duplicate events from being emitted
 * in quick succession using a time-based deduplication mechanism
 */
export class EventDeduplicator {
  private readonly recentEvents = new Map<string, number>();
  private readonly dedupWindowMs: number;

  constructor(dedupWindowMs: number = 5000) {
    this.dedupWindowMs = dedupWindowMs;
  }

  /**
   * Emit an event only if it hasn't been emitted recently
   */
  emitIfNotDuplicate<T>(eventEmitter: EventEmitter2, eventName: string, payload: T): boolean {
    const eventKey = this.generateEventKey(eventName, payload);
    const now = Date.now();
    const lastEmitted = this.recentEvents.get(eventKey);

    if (lastEmitted && now - lastEmitted < this.dedupWindowMs) {
      return false; // Event was recently emitted, skip
    }

    // Clean up old entries periodically
    this.cleanupOldEntries(now);

    // Emit the event and record the timestamp
    eventEmitter.emit(eventName, payload);
    this.recentEvents.set(eventKey, now);
    return true;
  }

  /**
   * Generate a unique key for an event based on its name and payload
   */
  private generateEventKey<T>(eventName: string, payload: T): string {
    const payloadString = JSON.stringify(payload, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value)
          .sort()
          .reduce((sorted, k) => {
            sorted[k] = value[k];
            return sorted;
          }, {} as any);
      }
      return value;
    });
    const hash = createHash('sha256').update(`${eventName}:${payloadString}`).digest('hex');
    return hash.substring(0, 16); // Use first 16 chars for efficiency
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanupOldEntries(now: number): void {
    if (this.recentEvents.size > 1000) {
      // Only clean up if map gets large
      for (const [key, timestamp] of this.recentEvents.entries()) {
        if (now - timestamp > this.dedupWindowMs * 2) {
          this.recentEvents.delete(key);
        }
      }
    }
  }

  /**
   * Clear all recent events (useful for testing)
   */
  clear(): void {
    this.recentEvents.clear();
  }

  /**
   * Get the number of tracked events
   */
  size(): number {
    return this.recentEvents.size;
  }
}
