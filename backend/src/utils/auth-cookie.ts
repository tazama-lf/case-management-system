/** Name of the single session cookie; overwritten on login and cleared on logout. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Prefix of the old per-user cookies (`access_token_<userId>`). They are no longer
 * read anywhere and are only cleared so they stop lingering in browsers.
 * Safe to remove once existing sessions have expired.
 */
export const LEGACY_ACCESS_TOKEN_COOKIE_PREFIX = 'access_token_';
