import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { CaseStatus, TaskStatus, Priority, CaseCreationType } from '@prisma/client';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly flowableService: FlowableService,
    private readonly configService: ConfigService, // Add ConfigService
  ) {}

  /**
   * Create a case via system-to-system transmission (User Story #185)
   * This method handles the ideal path for automatic case creation
   */
  async createCaseSystemTransmission(payload: any, clientId: string) {
    try {
      this.logger.log('System-to-system case creation initiated', CaseService.name);

      // Step 1: Validate payload
      const validationResult = await this.validateTazamaPayload(payload);
      if (!validationResult.isValid) {
        throw new BadRequestException(validationResult.errors);
      }

      // Step 2: Get system UUID from config (like in triage service)
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', clientId);
      this.logger.log(`Using system UUID: ${systemUuid}`, CaseService.name);

      // Step 3: Create case with DRAFT status
      const createdCase = await this.prismaService.$transaction(async (tx) => {
        // Create the case
        const newCase = await tx.case.create({
          data: {
            tenant_id: payload.tenantId,
            case_creator_user_id: systemUuid, // Use system UUID from config
            case_owner_user_id: systemUuid, // Initially owned by system
            status: CaseStatus.DRAFT_00,
            priority: payload.priority || Priority.NEW, // Use Priority enum
            case_type: payload.caseType,
            case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM, // Use enum
          },
        });

        // Create Alert record if present in payload
        if (payload.alertData) {
          await tx.alert.create({
            data: {
              case_id: newCase.case_id,
              tenant_id: payload.tenantId,
              priority: payload.priority || Priority.NEW,
              alert_type: payload.alertType,
              message: payload.message || 'System generated alert',
              alert_data: JSON.parse(JSON.stringify(payload.alertData)), // Ensure proper JSON
              transaction: JSON.parse(JSON.stringify(payload.transaction || {})),
              network_map: JSON.parse(JSON.stringify(payload.networkMap || {})),
              confidence_per: payload.confidencePercentage || 0,
              source: payload.source || 'TAZAMA',
              txtp: payload.transactionType,
            },
          });
        }

        // Create ATM task
        const atmTask = await tx.task.create({
          data: {
            case_id: newCase.case_id,
            status: TaskStatus.UNASSIGNED_01,
            assigned_user_id: systemUuid, // Initially assigned to system
            name: 'Alert Triage Module Review',
            description: 'Automatic triage and routing of alert',
          },
        });

        // Log creation events
        await this.auditLogService.logAction({
          userId: systemUuid,
          operation: 'createCase',
          entityName: CaseService.name,
          actionPerformed: `Case ${newCase.case_id} created via system transmission`,
          outcome: Outcome.SUCCESS,
        });

        await this.auditLogService.logAction({
          userId: systemUuid,
          operation: 'createTask',
          entityName: CaseService.name,
          actionPerformed: `ATM task ${atmTask.task_id} created`,
          outcome: Outcome.SUCCESS,
        });

        return { case: newCase, atmTask };
      });

      // Step 4: Start Flowable process
      const processInstance = await this.flowableService.startProcessInstance(
        'caseCreationProcess',
        {
          caseId: createdCase.case.case_id,
          tenantId: payload.tenantId,
          priority: payload.priority,
          caseType: payload.caseType,
          alertData: JSON.stringify(payload.alertData || {}),
          autocloseEligible: this.checkAutocloseEligibility(payload),
        },
        createdCase.case.case_id,
      );

      // Step 5: Route to ATM
      await this.routeToATM(createdCase.case.case_id, createdCase.atmTask.task_id, systemUuid);

      // Step 6: Check for autoclose and distinguish confirmed/refuted
      const confidence = payload.confidencePercentage || 0;
      const fraudType = payload.fraudType || '';
      // Diagram: Confidence >= 95% and True Positive (e.g., Money-Laundering, Fraud Only, Transaction Blocked)
      if (confidence >= 95) {
        // If true positive (fraudType is one of the types that should be confirmed)
        if (['Money-Laundering', 'Fraud Only', 'Transaction Blocked'].includes(fraudType)) {
          await this.autocloseCase(createdCase.case.case_id, systemUuid, CaseStatus.AUTOCLOSED_CONFIRMED_71);
        } else {
          // False positive
          await this.autocloseCase(createdCase.case.case_id, systemUuid, CaseStatus.AUTOCLOSED_REFUTED_72);
        }
      } else {
        // Confidence < 95%: Prioritize and investigate
        await this.createInvestigationTask(createdCase.case.case_id, systemUuid);
        // Set ATM task to COMPLETE_30 as per requirements
        await this.prismaService.task.update({
          where: { task_id: createdCase.atmTask.task_id },
          data: {
            status: TaskStatus.COMPLETED_30,
            updated_at: new Date(),
          },
        });
        // Audit log for ATM task completion
        await this.auditLogService.logAction({
          userId: systemUuid,
          operation: 'completeATMTask',
          entityName: CaseService.name,
          actionPerformed: `ATM task ${createdCase.atmTask.task_id} set to COMPLETE_30`,
          outcome: Outcome.SUCCESS,
        });
      }

      this.logger.log(`Case ${createdCase.case.case_id} created successfully via system transmission`, CaseService.name);

      // Fetch the latest case status after autoclose/investigation
      const finalCase = await this.prismaService.case.findUnique({
        where: { case_id: createdCase.case.case_id },
      });

      return {
        caseId: createdCase.case.case_id,
        status: finalCase?.status || createdCase.case.status,
        processInstanceId: processInstance.id,
      };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseService.name);

      // Log failure
      await this.auditLogService.logAction({
        userId: this.configService.get<string>('SYSTEM_UUID', clientId),
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: 'Failed to create case via system transmission',
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  /**
   * Validate Tazama payload
   */
  private async validateTazamaPayload(payload: any): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check required fields
    if (!payload.tenantId) errors.push('tenantId is required');
    if (!payload.alertData && !payload.transaction) errors.push('alertData or transaction data is required');

    // Validate alert status (only ALRT accepted, drop NALT)
    if (payload.reportStatus && payload.reportStatus !== 'ALRT') {
      errors.push('Only ALRT status is accepted for case creation');
    }

    // Validate data formats
    if (payload.confidencePercentage && (payload.confidencePercentage < 0 || payload.confidencePercentage > 100)) {
      errors.push('Confidence percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Route case to ATM
   */
  private async routeToATM(caseId: string, taskId: string, systemUuid: string) {
    try {
      // Update task to show it's been routed to ATM
      await this.prismaService.task.update({
        where: { task_id: taskId },
        data: {
          status: TaskStatus.IN_PROGRESS_20,
          updated_at: new Date(),
        },
      });

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'routeToATM',
        entityName: CaseService.name,
        actionPerformed: `Task ${taskId} routed to ATM`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} routed to ATM`, CaseService.name);
    } catch (error) {
      this.logger.error(`Failed to route case to ATM: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  /**
   * Check if case is eligible for autoclose
   */
  private checkAutocloseEligibility(payload: any): boolean {
    // Implement your autoclose logic here
    // For example, check confidence percentage, risk score, etc.
    const confidencePercentage = payload.confidencePercentage || 0;
    const riskScore = payload.riskScore || 0;

    // Example: autoclose if confidence is low and risk is minimal
    return confidencePercentage < 30 && riskScore < 20;
  }

  /**
   * Autoclose a case
   */
  private async autocloseCase(caseId: string, systemUuid: string, status: CaseStatus) {
    try {
      await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          status: status,
          updated_at: new Date(),
        },
      });

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'autocloseCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} autoclosed with status ${status}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} autoclosed with status ${status}`, CaseService.name);
    } catch (error) {
      this.logger.error(`Failed to autoclose case: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  /**
   * Create investigation task and assign to queue
   */
  private async createInvestigationTask(caseId: string, systemUuid: string) {
    try {
      const investigationTask = await this.prismaService.task.create({
        data: {
          case_id: caseId,
          status: TaskStatus.UNASSIGNED_01,
          assigned_user_id: null, // Unassigned initially
          name: 'Investigate Case',
          description: 'Investigate the reported suspicious activity',
        },
      });

      // Update case status and owner
      await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          status: CaseStatus.READY_FOR_ASSIGNMENT_02,
          case_owner_user_id: null, // Ensure no owner
          updated_at: new Date(),
        },
      });

      // Assign to Investigations candidate group in Flowable
      const flowableTasks = await this.flowableService.getProcessTasks(caseId);
      if (flowableTasks && flowableTasks.length > 0) {
        // The task should be automatically assigned to the Investigations group via BPMN
        this.logger.log('Investigation task created and assigned to Investigations queue', CaseService.name);
      }

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'createTask',
        entityName: CaseService.name,
        actionPerformed: `Investigation task ${investigationTask.task_id} created`,
        outcome: Outcome.SUCCESS,
      });

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'assignTask',
        entityName: CaseService.name,
        actionPerformed: `Investigation task ${investigationTask.task_id} assigned to Investigations group`,
        outcome: Outcome.SUCCESS,
      });

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'system_assignTask', // Use a unique operation value for system logs
        entityName: CaseService.name,
        actionPerformed: `Investigation task ${investigationTask.task_id} assigned to Investigations group`,
        outcome: Outcome.SUCCESS,
      });

      return investigationTask;
    } catch (error) {
      this.logger.error(`Failed to create investigation task: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    //  createCase method
    try {
      this.logger.log('Creating case', CaseService.name);
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
      include: {
        alert: true,
        tasks: true,
      },
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
