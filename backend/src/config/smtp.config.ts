/**
 * Parses `SMTP_NOTIFICATIONS`, the feature switch for outbound email notifications.
 *
 * The variable is required and validated at startup (see env.validation.ts): a missing
 * or malformed value stops the backend from booting, rather than letting it queue
 * emails that can never be delivered.
 *
 * @param raw - Env var value, already validated as `true` or `false` in any case.
 * @returns Whether email notifications are switched on.
 */
export const parseSmtpNotificationsFlag = (raw: string): boolean => raw.toLowerCase() === 'true';

/**
 * Trims an SMTP setting and returns `undefined` when nothing is left, so startup
 * validation and the email worker agree on which settings count as set.
 *
 * @param raw - Raw env var value, if any.
 * @returns The trimmed value, or `undefined` when it is missing or whitespace-only.
 */
export const normalizeSmtpSetting = (raw?: string): string | undefined => {
  const value = raw?.trim();
  return value === '' ? undefined : value;
};
