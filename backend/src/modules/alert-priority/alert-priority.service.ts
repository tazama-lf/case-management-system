import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, SlaState } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseRepository } from '../repository/case.repository';
import { NotificationService } from '../notification/notification.service';
import { CANDIDATE_GROUPS } from '../../constants/case.constants';
import { determineSlaState } from './sla-state.util';
import { SlaPolicyUtil, type SlaEscalationRatios } from '../shared/utils/sla-policy.util';
import { CaseSlaBreachedEvent } from '../events/domain-events';

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
    private readonly eventEmitter: EventEmitter2,
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

    const results = await Promise.allSettled(
      openCases.map(async (caseRecord) => {
        await this.checkCase(caseRecord, now, ratiosByTenant.get(caseRecord.tenant_id)!);
      }),
    );

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    for (const failure of failures) {
      this.logger.error('Unexpected error while checking a case for SLA escalation', failure.reason as Error);
    }

    this.logger.log(`SLA escalation check complete. Evaluated ${openCases.length} open case(s).`);

    // Still surface unexpected failures to the caller (rather than swallowing them) so
    // the cron tick is visibly marked failed for monitoring, matching escalate()'s
    // deliberate choice to let non-idempotency-race errors propagate.
    if (failures.length > 0) {
      const [{ reason }] = failures;
      throw reason instanceof Error ? reason : new Error(String(reason));
    }
  }

  private async checkCase(caseRecord: SlaCheckCase, now: Date, ratios: SlaEscalationRatios): Promise<void> {
    if (!caseRecord.sla_due_at) {
      return;
    }

    const state = determineSlaState(caseRecord.created_at, caseRecord.sla_due_at, now, ratios);
    const isUnclaimed = !caseRecord.case_owner_user_id;

    // BREACHED overrides AT_RISK/DUE_SOON regardless of claim status — a case that's
    // already missed its deadline needs ops attention whether or not it's been claimed.
    if (state === SlaState.BREACHED) {
      await this.escalate(caseRecord, SlaState.BREACHED, now);
    } else if (isUnclaimed && state === SlaState.AT_RISK) {
      await this.escalate(caseRecord, SlaState.AT_RISK, now);
    } else if (!isUnclaimed && state === SlaState.DUE_SOON) {
      await this.escalate(caseRecord, SlaState.DUE_SOON, now);
    }
  }

  private async escalate(
    caseRecord: SlaCheckCase,
    state: typeof SlaState.AT_RISK | typeof SlaState.DUE_SOON | typeof SlaState.BREACHED,
    now: Date,
  ): Promise<void> {
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
      } else if (state === SlaState.DUE_SOON) {
        await this.notificationService.sendNotification({
          userId: caseRecord.case_owner_user_id!,
          type: 'CASE_SUPPORT_CHASE',
          message: `Case ${caseRecord.case_id} is due soon`,
          metadata,
        });
      } else {
        await this.notificationService.sendGroupNotification({
          candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
          type: 'CASE_SLA_BREACHED',
          message: `Case ${caseRecord.case_id} has breached its SLA deadline`,
          metadata,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send ${state} notification for case ${caseRecord.case_id}, will retry next cron tick`, error as Error);
      return;
    }

    if (state === SlaState.BREACHED) {
      this.eventEmitter.emit(
        'case.sla-breached',
        new CaseSlaBreachedEvent(
          caseRecord.case_id,
          caseRecord.tenant_id,
          caseRecord.case_type,
          caseRecord.case_owner_user_id,
          caseRecord.sla_due_at!,
        ),
      );
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
