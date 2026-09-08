/**
 * Parses the comma-separated `CORS_ALLOWED_ORIGINS` env var into the exact-match
 * origin list handed to `app.enableCors()`.
 *
 * Returning an explicit list (rather than `origin: true`, which reflects whatever
 * the browser sends) is what makes `credentials: true` safe: the CMS API is
 * cookie-authenticated, so a reflected origin lets any site the user visits drive
 * authenticated requests and read the responses.
 *
 * @param raw - Raw env var value: comma-separated origins, e.g. `http://localhost:5175`.
 * @returns The trimmed, non-empty origins.
 * @throws Error if no usable origin is present — an empty value must never be
 *   read as "allow everything".
 */
export const parseAllowedOrigins = (raw: string): string[] => {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must list at least one origin');
  }

  return origins;
};
