import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  logAudit(action: string, user: any, details?: any) {
    this.logger.log(`[AUDIT] ${action} by user ${user?.sub || 'unknown'} (tenant: ${user?.tenantId || 'unknown'})`, details);
    // In production, persist to DB or external audit log
  }
}