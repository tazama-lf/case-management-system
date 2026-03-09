export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}
