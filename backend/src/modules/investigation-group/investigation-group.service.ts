import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class InvestigationGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvestigationGroup(alertId: number, tenantId: string): Promise<{ id: number }> {
    return await this.prisma.investigationGroup.create({
      data: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
      },
    });
  }
}
