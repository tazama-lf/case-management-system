/**
 * Parses the comma-separated `CORS_ALLOWED_ORIGINS` env var into the exact-match
 * origin list handed to `app.enableCors()`.
 *
 * Returning an explicit list (rather than `origin: true`, which reflects whatever
 * the browser sends) is what makes `credentials: true` safe: the CMS API is
 * cookie-authenticated, so a reflected origin lets any site the user visits drive
 * authenticated requests and read the responses.
 *
 * Each entry must be an exact browser origin — scheme (http/https) + host +
 * optional port, nothing more. A value carrying a path, query, fragment,
 * credentials, or a trailing slash never matches the `Origin` header the browser
 * sends, so it would silently allow nothing; we fail startup instead of shipping
 * a rule that can never fire.
 *
 * @param raw - Raw env var value: comma-separated origins, e.g. `http://localhost:5175`.
 * @returns The trimmed, validated origins.
 * @throws Error if no usable origin is present — an empty value must never be
 *   read as "allow everything" — or if any entry is not an exact origin.
 */
export const parseAllowedOrigins = (raw: string): string[] => {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must list at least one origin');
  }

  for (const origin of origins) {
    assertExactOrigin(origin);
  }

  return origins;
};

/**
 * Throws unless `value` is exactly `scheme://host[:port]` with an http(s) scheme
 * and no userinfo, path, query, or fragment — i.e. it equals a browser `Origin`.
 */
const assertExactOrigin = (value: string): void => {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error(`CORS_ALLOWED_ORIGINS entry is not a valid origin: ${value}`, { cause });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`CORS_ALLOWED_ORIGINS entry must use http or https: ${value}`);
  }

  // `url.origin` is the canonical exact origin; anything the input carries beyond
  // it (path, query, fragment, credentials, trailing slash) makes them differ.
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || value !== url.origin) {
    throw new Error(`CORS_ALLOWED_ORIGINS entry must be a bare origin (no path, query, fragment, or trailing slash): ${value}`);
  }
};
