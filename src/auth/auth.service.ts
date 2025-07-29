import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  logAudit(action: string, user: any, details?: any) {
    this.logger.log(`[AUDIT] ${action} by user ${user?.sub || 'unknown'} (tenant: ${user?.tenantId || 'unknown'})`, details);
    // In production, persist to DB or external audit log
  }
    async getCasesForTenant(user: JwtPayload) {
    return this.prisma.case.findMany({
      where: { tenantId: user.tenantId },
    });
  }
}