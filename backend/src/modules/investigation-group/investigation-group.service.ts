import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class InvestigationGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvestigationGroup(alertId: number, tenantId: string, tx?: Prisma.TransactionClient): Promise<{ id: number }> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.investigationGroup.upsert({
      where: { alert_id: alertId },
      create: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
      update: {},
      select: {
        id: true,
      },
    });
  }
}
