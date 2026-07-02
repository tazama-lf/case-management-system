import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Priority } from '@prisma/client-cms';

export const DEFAULT_SLA_TENANT_KEY = 'DEFAULT';

const FALLBACK_TARGET_HOURS: Record<Priority, number> = {
  [Priority.HIGH]: 24,
  [Priority.MEDIUM]: 72,
  [Priority.LOW]: 168,
};

const MS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class SlaPolicyUtil {
  constructor(private readonly prisma: PrismaService) {}

  async getTargetHours(tenantId: string, priority: Priority): Promise<number> {
    const tenantPolicy = await this.prisma.slaPolicy.findFirst({
      where: { tenant_id: tenantId, priority },
    });
    if (tenantPolicy) {
      return tenantPolicy.target_hours;
    }

    const defaultPolicy = await this.prisma.slaPolicy.findFirst({
      where: { tenant_id: DEFAULT_SLA_TENANT_KEY, priority },
    });
    if (defaultPolicy) {
      return defaultPolicy.target_hours;
    }

    return FALLBACK_TARGET_HOURS[priority];
  }

  async calculateSlaDueAt(createdAt: Date, tenantId: string, priority: Priority): Promise<Date> {
    const targetHours = await this.getTargetHours(tenantId, priority);
    return new Date(createdAt.getTime() + targetHours * MS_PER_HOUR);
  }
}
