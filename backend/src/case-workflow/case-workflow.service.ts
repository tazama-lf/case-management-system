import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { Outcome } from '../audit/types/outcome';
import { CaseCreatedEvent } from '../events/domain-events';

@Injectable()
export class CaseWorkflowService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    try {
      this.logger.log(`[CaseWorkflow] Creating case for user ${userId}`, CaseWorkflowService.name);

      const createdCase = await this.prismaService.case.create({
        data: {
          tenant_id: createCaseDTO.tenantId,
          case_creator_user_id: createCaseDTO.caseCreatorUserId,
          case_owner_user_id: createCaseDTO.caseOwnerUserId,
          status: createCaseDTO.status,
          priority: createCaseDTO.priority,
          parent_id: createCaseDTO.parentId ?? null,
          case_type: createCaseDTO.caseType,
          case_creation_type: createCaseDTO.caseCreationType,
        },
      });

      this.logger.log(`[CaseWorkflow] Case ${createdCase.case_id} created, emitting case.created event`, CaseWorkflowService.name);

      this.eventEmitter.emit(
          'case.created',
          new CaseCreatedEvent(
              createdCase.case_id,
              createdCase.tenant_id,
              createCaseDTO.caseCreationType,
              createdCase.status,
              false
          ),
      );

      this.auditLogService.logAction({
        userId,
        operation: 'createCase',
        entityName: 'Case',
        actionPerformed: `Case ${createdCase.case_id} created`,
        outcome: Outcome.SUCCESS,
      });

      return createdCase;
    } catch (error) {
      this.logger.error(`[CaseWorkflow] Error creating case: ${error.message}`, error.stack, CaseWorkflowService.name);
      throw error;
    }
  }
}
