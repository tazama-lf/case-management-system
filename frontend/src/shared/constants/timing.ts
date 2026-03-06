/**
 * Timing constants for API calls, cache, and intervals
 * All values are in milliseconds
 */

// Base time units
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

// Common intervals in milliseconds
export const ONE_SECOND = MILLISECONDS_PER_SECOND;
export const ONE_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
export const FIVE_MINUTES = ONE_MINUTE * 5;
export const TEN_MINUTES = ONE_MINUTE * 10;
export const FIFTEEN_MINUTES = ONE_MINUTE * 15;
export const THIRTY_MINUTES = ONE_MINUTE * 30;

// Default cache times
export const DEFAULT_STALE_TIME = FIVE_MINUTES;
export const DEFAULT_REFETCH_INTERVAL = FIVE_MINUTES;

// Long cache times
export const LONG_STALE_TIME = TEN_MINUTES;
export const LONG_REFETCH_INTERVAL = TEN_MINUTES;

// Short cache times
export const SHORT_STALE_TIME = ONE_MINUTE;

// No cache
export const NO_CACHE = 0;
