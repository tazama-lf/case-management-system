import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client-cms';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DEFAULT_TENANT_KEY } from './sla-policy.util';

export const FALLBACK_HIGH_THRESHOLD = 0.7;
export const FALLBACK_MEDIUM_THRESHOLD = 0.4;

export interface CasePriorityThresholds {
  highThreshold: number;
  mediumThreshold: number;
}

@Injectable()
export class CasePriorityUtil {
  constructor(private readonly prisma: PrismaService) {}

  async getThresholds(tenantId: string): Promise<CasePriorityThresholds> {
    const tenantThreshold = await this.prisma.casePriorityThreshold.findUnique({
      where: { tenant_id: tenantId },
    });
    if (tenantThreshold) {
      return { highThreshold: tenantThreshold.high_threshold, mediumThreshold: tenantThreshold.medium_threshold };
    }

    const defaultThreshold = await this.prisma.casePriorityThreshold.findUnique({
      where: { tenant_id: DEFAULT_TENANT_KEY },
    });
    if (defaultThreshold) {
      return { highThreshold: defaultThreshold.high_threshold, mediumThreshold: defaultThreshold.medium_threshold };
    }

    return { highThreshold: FALLBACK_HIGH_THRESHOLD, mediumThreshold: FALLBACK_MEDIUM_THRESHOLD };
  }

  async determinePriority(priorityScore: number, tenantId: string): Promise<Priority> {
    const { highThreshold, mediumThreshold } = await this.getThresholds(tenantId);
    if (priorityScore >= highThreshold) {
      return Priority.HIGH;
    } else if (priorityScore >= mediumThreshold) {
      return Priority.MEDIUM;
    } else {
      return Priority.LOW;
    }
  }
}
