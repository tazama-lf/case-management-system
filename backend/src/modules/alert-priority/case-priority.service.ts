import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Case, Priority } from '@prisma/client-cms';
import { CaseRepository } from '../repository/case.repository';
import { CasePriorityChangedEvent } from '../events/domain-events';

export interface PriorityChangeResult {
  case: Case;
  caseId: number;
  actorId: string;
  oldPriority: Priority;
  newPriority: Priority;
  reason: string | null;
}

@Injectable()
export class CasePriorityService {
  private readonly logger = new Logger(CasePriorityService.name);

  constructor(
    private readonly caseRepository: CaseRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Supervisor-only access is enforced by @RequireSupervisorRole() on the controller
  // route — no role check here, so there's a single, guard-level source of truth.
  async changePriority(
    caseId: number,
    newPriority: Priority,
    actorId: string,
    tenantId: string,
    reason?: string,
  ): Promise<PriorityChangeResult> {
    const existingCase = await this.caseRepository.findCaseById(caseId, tenantId);
    const oldPriority = existingCase.priority;

    // updateCase re-stamps sla_due_at anchored to created_at whenever priority changes.
    const updatedCase = await this.caseRepository.updateCase(caseId, { priority: newPriority });

    this.eventEmitter.emit('case.priority.changed', new CasePriorityChangedEvent(caseId, actorId, oldPriority, newPriority, reason));

    this.logger.log(`Case ${caseId} priority changed from ${oldPriority} to ${newPriority} by ${actorId}`);

    return {
      case: updatedCase,
      caseId,
      actorId,
      oldPriority,
      newPriority,
      reason: reason ?? null,
    };
  }
}
