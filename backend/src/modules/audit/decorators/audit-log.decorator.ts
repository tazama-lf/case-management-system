import { SetMetadata } from '@nestjs/common';

export interface AuditLogOptions {
  eventType: string;
  resourceType: string;
  resourceId?: string;
  description?: string;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}

export const AUDIT_LOG_OPTIONS_KEY = 'auditLogOptions';
export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_OPTIONS_KEY, options);
