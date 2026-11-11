import helmet from 'helmet';

export const securityHeaders = (frameAncestorOrigins: string[], isProduction: boolean): ReturnType<typeof helmet> =>
  helmet({
    contentSecurityPolicy: {
      directives: {
        // eslint-disable-next-line @stylistic/quotes -- CSP keywords are literal single-quoted values (e.g. 'self'); double-quoting is the only form prettier and eslint agree on here
        defaultSrc: ["'self'"],
        // eslint-disable-next-line @stylistic/quotes -- see defaultSrc above
        frameAncestors: ["'self'", ...frameAncestorOrigins],
        // eslint-disable-next-line @stylistic/quotes -- see defaultSrc above
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // eslint-disable-next-line @stylistic/quotes -- see defaultSrc above
        styleSrc: ["'self'", "'unsafe-inline'"],
        // eslint-disable-next-line @stylistic/quotes -- see defaultSrc above
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    // Browsers ignore this header on a plain-HTTP, non-localhost origin and log a console warning for it, so it is only sent in production
    crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,
  });
