/**
 * Decorator to prevent duplicate event emissions within a specified time window
 */

const eventHistory = new Map<string, number>();
const DEFAULT_DEBOUNCE_MS = 1000;

export function PreventDuplicateEvents(debounceMs: number = DEFAULT_DEBOUNCE_MS) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const eventKey = `${target.constructor.name}.${propertyName}.${JSON.stringify(args)}`;
      const now = Date.now();
      const lastEmitted = eventHistory.get(eventKey);

      if (lastEmitted && now - lastEmitted < debounceMs) {
        // Skip duplicate event within debounce window
        return;
      }

      eventHistory.set(eventKey, now);

      // Clean up old entries periodically
      if (eventHistory.size > 1000) {
        const cutoff = now - debounceMs * 10;
        for (const [key, timestamp] of eventHistory.entries()) {
          if (timestamp < cutoff) {
            eventHistory.delete(key);
          }
        }
      }

      return method.apply(this, args);
    };
  };
}

/**
 * Service-level event deduplication utility
 */
export class EventDeduplicator {
  private static instance: EventDeduplicator;
  private eventCache = new Map<string, number>();
  private readonly DEFAULT_TTL_MS = 5000;

  static getInstance(): EventDeduplicator {
    if (!EventDeduplicator.instance) {
      EventDeduplicator.instance = new EventDeduplicator();
    }
    return EventDeduplicator.instance;
  }

  /**
   * Check if an event should be emitted (not a duplicate)
   */
  shouldEmit(eventName: string, payload: any, ttlMs: number = this.DEFAULT_TTL_MS): boolean {
    const eventKey = `${eventName}:${this.generatePayloadHash(payload)}`;
    const now = Date.now();
    const lastEmitted = this.eventCache.get(eventKey);

    if (lastEmitted && now - lastEmitted < ttlMs) {
      return false; // Duplicate within TTL window
    }

    this.eventCache.set(eventKey, now);
    this.cleanupExpiredEntries(now, ttlMs);
    return true;
  }

  private generatePayloadHash(payload: any): string {
    try {
      return Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 32);
    } catch {
      return String(payload).slice(0, 32);
    }
  }

  private cleanupExpiredEntries(now: number, ttlMs: number): void {
    if (this.eventCache.size <= 1000) return;

    const expiredThreshold = now - ttlMs;
    for (const [key, timestamp] of this.eventCache.entries()) {
      if (timestamp < expiredThreshold) {
        this.eventCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached events (useful for testing)
   */
  clear(): void {
    this.eventCache.clear();
  }
}
