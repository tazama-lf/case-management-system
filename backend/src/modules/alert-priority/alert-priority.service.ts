import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SlaState } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseRepository } from '../repository/case.repository';
import { NotificationService } from '../notification/notification.service';
import { CANDIDATE_GROUPS } from '../../constants/case.constants';
import { determineSlaState } from './sla-state.util';
import { SlaPolicyUtil, type SlaEscalationRatios } from '../shared/utils/sla-policy.util';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const MS_PER_HOUR = 60 * 60 * 1000;

interface SlaCheckCase {
  case_id: number;
  case_type: string | null;
  case_owner_user_id: string | null;
  created_at: Date;
  sla_due_at: Date | null;
  tenant_id: string;
}

@Injectable()
export class AlertPriorityService {
  private readonly logger = new Logger(AlertPriorityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseRepository: CaseRepository,
    private readonly notificationService: NotificationService,
    private readonly slaPolicyUtil: SlaPolicyUtil,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runSlaEscalationCheck(): Promise<void> {
    this.logger.log('Starting SLA escalation check...');
    const openCases = await this.caseRepository.findOpenCasesForSlaCheck();
    const now = new Date();

    // Resolve each distinct tenant's ratios once (not per case) to avoid an
    // N+1 lookup across a cron batch that may span many tenants.
    const tenantIds = [...new Set(openCases.map((c) => c.tenant_id))];
    const ratiosByTenant = new Map<string, SlaEscalationRatios>(
      await Promise.all(
        tenantIds.map(
          async (tenantId): Promise<[string, SlaEscalationRatios]> => [tenantId, await this.slaPolicyUtil.getEscalationRatios(tenantId)],
        ),
      ),
    );

    await Promise.all(
      openCases.map(async (caseRecord) => {
        await this.checkCase(caseRecord, now, ratiosByTenant.get(caseRecord.tenant_id)!);
      }),
    );

    this.logger.log(`SLA escalation check complete. Evaluated ${openCases.length} open case(s).`);
  }

  private async checkCase(caseRecord: SlaCheckCase, now: Date, ratios: SlaEscalationRatios): Promise<void> {
    if (!caseRecord.sla_due_at) {
      return;
    }

    const state = determineSlaState(caseRecord.created_at, caseRecord.sla_due_at, now, ratios);
    const isUnclaimed = !caseRecord.case_owner_user_id;

    if (isUnclaimed && state === SlaState.AT_RISK) {
      await this.escalate(caseRecord, SlaState.AT_RISK, now);
    } else if (!isUnclaimed && state === SlaState.DUE_SOON) {
      await this.escalate(caseRecord, SlaState.DUE_SOON, now);
    }
  }

  private async escalate(caseRecord: SlaCheckCase, state: typeof SlaState.AT_RISK | typeof SlaState.DUE_SOON, now: Date): Promise<void> {
    const alreadyNotified = await this.prisma.slaEscalationRecord.findUnique({
      where: { case_id_sla_state: { case_id: caseRecord.case_id, sla_state: state } },
    });
    if (alreadyNotified) {
      return;
    }

    const timeRemainingHours = Math.max(0, Math.round(((caseRecord.sla_due_at!.getTime() - now.getTime()) / MS_PER_HOUR) * 10) / 10);
    const metadata = {
      caseId: caseRecord.case_id,
      caseType: caseRecord.case_type,
      slaState: state,
      timeRemainingHours,
      assignee: caseRecord.case_owner_user_id,
    };

    try {
      if (state === SlaState.AT_RISK) {
        await this.notificationService.sendGroupNotification({
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          type: 'CASE_CLAIM_CHASE',
          message: `Case ${caseRecord.case_id} is at risk of breaching its SLA and is still unclaimed`,
          metadata,
        });
      } else {
        await this.notificationService.sendNotification({
          userId: caseRecord.case_owner_user_id!,
          type: 'CASE_SUPPORT_CHASE',
          message: `Case ${caseRecord.case_id} is due soon`,
          metadata,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send ${state} notification for case ${caseRecord.case_id}, will retry next cron tick`, error as Error);
      return;
    }

    try {
      await this.prisma.slaEscalationRecord.create({
        data: { case_id: caseRecord.case_id, sla_state: state },
      });
    } catch (error) {
      // A concurrent run may have already recorded this — the unique constraint on
      // (case_id, sla_state) is the actual source of truth for idempotency.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION)) {
        throw error;
      }
    }
  }
}
