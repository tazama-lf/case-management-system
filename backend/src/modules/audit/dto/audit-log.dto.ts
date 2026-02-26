export enum AuditPhase {
  INTENT = 'INTENT',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface IAuditLogBaseDto {
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  eventType: string;
  sourceIp: string;
  description: string;
  tenantId: string;
  actionPerformed?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
}
