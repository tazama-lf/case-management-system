import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    try {
      this.logger.log('Creating case', CaseService.name);

      const createdCase = await this.prismaService.case.create({
        data: {
          tenant_id: createCaseDTO.tenantId,
          case_creator_user_id: createCaseDTO.caseCreatorUserId,
          case_owner_user_id: createCaseDTO.caseOwnerUserId,
          status: createCaseDTO.status,
          priority: createCaseDTO.priority,
          case_type: createCaseDTO.caseType,
          case_creation_type: createCaseDTO.caseCreationType,
        },
      });

      this.logger.log(`Case created successfully: ${createdCase.case_id}`, CaseService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: 'Case created',
        outcome: Outcome.SUCCESS,
      });
      return createdCase;
    } catch (error) {
      this.logger.error(`Error creating case: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async retrieveCase(caseId: string) {
    this.logger.log(`Retrieving case: ${caseId}`, CaseService.name);

    const retrievedCase = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
    });

    if (!retrievedCase) {
      this.logger.warn(`Case not found: ${caseId}`, CaseService.name);
      throw new NotFoundException(`Case not found: ${caseId}`);
    }

    this.logger.log(`Case retrieved successfully: ${retrievedCase.case_id}`, CaseService.name);
    return retrievedCase;
  }

  async updateCase(caseId: string, updateData: Partial<UpdateCaseDto>, userId: string) {
    this.logger.log(`Updating case: ${caseId}`, CaseService.name);

    try {
      const updatedCase = await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          case_type: updateData.caseType,
          priority: updateData.priority,
          status: updateData.status,
          case_owner_user_id: updateData.caseOwnerUserId,
        },
      });

      this.logger.log(`Case updated successfully: ${updatedCase.case_id}`, CaseService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(`Error updating case: ${error.message}`, error.stack, CaseService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: 'Error updating case',
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }
}
