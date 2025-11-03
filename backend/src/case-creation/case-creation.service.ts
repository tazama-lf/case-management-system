import {Injectable, NotFoundException} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { Outcome } from '../audit/types/outcome';
import {CaseCreatedEvent, CaseStatusChangedEvent} from '../events/domain-events';
import {AlertType, CaseStatus, Priority} from "@prisma/client";

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    try {
      this.logger.log(`[CaseWorkflow] Creating case for user ${userId}`, CaseCreationService.name);

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

      this.logger.log(`[CaseWorkflow] Case ${createdCase.case_id} created, emitting case.created event`, CaseCreationService.name);

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
      this.logger.error(`[CaseWorkflow] Error creating case: ${error.message}`, error.stack, CaseCreationService.name);
      throw error;
    }
  }

  async updateCaseStatus(
      caseId: string,
      status: CaseStatus,
      userId: string,
      additionalUpdates?: { priority?: Priority; alertType?: AlertType }
  ): Promise<void> {
    try {
      const existingCase = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
      });

      if (!existingCase) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date(),
      };

      if (additionalUpdates?.priority) {
        updateData.priority = additionalUpdates.priority;
      }

      if (additionalUpdates?.alertType) {
        updateData.case_type = additionalUpdates.alertType;
      }

      const updatedCase = await this.prismaService.case.update({
        where: { case_id: caseId },
        data: updateData,
      });

      // Emit event
      this.eventEmitter.emit(
          'case.status.changed',
          new CaseStatusChangedEvent(caseId, existingCase.status, status, 'Case status updated')
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'updateCaseStatus',
        entityName: 'CaseCreationService',
        actionPerformed: `Updated case ${caseId} status to ${status}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} status updated to ${status}`, 'CaseCreationService');
    } catch (error) {
      this.logger.error(
          `Failed to update case status for ${caseId}: ${error.message}`,
          error.stack,
          'CaseCreationService',
      );
      throw error;
    }
  }
}
