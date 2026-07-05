import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Priority } from '@prisma/client-cms';

export const DEFAULT_SLA_TENANT_KEY = 'DEFAULT';

const FALLBACK_TARGET_HOURS: Record<Priority, number> = {
  [Priority.HIGH]: 24,
  [Priority.MEDIUM]: 72,
  [Priority.LOW]: 168,
};

// Priority-agnostic: how much of a case's created_at->sla_due_at window may
// elapse before it's classified AT_RISK / DUE_SOON. See sla-state.util.ts.
export const FALLBACK_DUE_SOON_RATIO = 0.2;
export const FALLBACK_AT_RISK_RATIO = 0.5;

const MS_PER_HOUR = 60 * 60 * 1000;

export interface SlaEscalationRatios {
  dueSoonRatio: number;
  atRiskRatio: number;
}

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

  async getEscalationRatios(tenantId: string): Promise<SlaEscalationRatios> {
    const tenantThreshold = await this.prisma.slaEscalationThreshold.findUnique({
      where: { tenant_id: tenantId },
    });
    if (tenantThreshold) {
      return { dueSoonRatio: tenantThreshold.due_soon_ratio, atRiskRatio: tenantThreshold.at_risk_ratio };
    }

    const defaultThreshold = await this.prisma.slaEscalationThreshold.findUnique({
      where: { tenant_id: DEFAULT_SLA_TENANT_KEY },
    });
    if (defaultThreshold) {
      return { dueSoonRatio: defaultThreshold.due_soon_ratio, atRiskRatio: defaultThreshold.at_risk_ratio };
    }

    return { dueSoonRatio: FALLBACK_DUE_SOON_RATIO, atRiskRatio: FALLBACK_AT_RISK_RATIO };
  }
}
