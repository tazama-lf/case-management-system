/**
 * Accepted values of `SMTP_NOTIFICATIONS`, the feature switch for outbound email
 * notifications: `true` or `false`, in any case (`TRUE`/`FALSE` work too).
 */
export const SMTP_NOTIFICATIONS_PATTERN = /^(?:true|false)$/iv;

/**
 * Parses `SMTP_NOTIFICATIONS`.
 *
 * The variable is required and validated at startup (see env.validation.ts): a missing
 * or malformed value stops the backend from booting, rather than letting it queue
 * emails that can never be delivered.
 *
 * @param raw - Raw env var value, already validated against `SMTP_NOTIFICATIONS_PATTERN`.
 * @returns Whether email notifications are switched on.
 */
export const parseSmtpNotificationsFlag = (raw: string): boolean => raw.toLowerCase() === 'true';
