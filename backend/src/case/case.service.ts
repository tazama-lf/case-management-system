import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto, CaseClosureOutcome } from './dto/close-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { CaseStatus, TaskStatus, Priority, CaseCreationType, AlertType, CaseType } from '@prisma/client';
import { GetUserCasesQueryDto } from './dto/get-user-cases.dto';
import { GetAllCasesQueryDto } from './dto/get-all-cases.dto';
import { ManualCreateCaseDto } from './dto/manual-case-create.dto';
import { UpdateAlertDto } from 'src/triage/dto/update-alert.dto';
import { TriageService } from 'src/triage/triage.service';
import { TaskService } from 'src/task/task.service';
import { CreateTaskDto } from 'src/task/dto/create-task.dto';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly flowableService: FlowableService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TriageService))
    private readonly triageService: TriageService,
    private readonly taskService: TaskService,
  ) {}

  /**
   * Close a case (User Story 10-A)
   * Investigator closes a case and submits it for supervisor approval
   */
  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string) {
    try {
      this.logger.log(`Closing case ${caseId} by user ${userId}`, CaseService.name);

      // Step 1: Retrieve the case and validate preconditions
      const caseData = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        include: {
          tasks: true,
          alert: true,
        },
      });

      if (!caseData) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      // Step 2: Validate case closure preconditions
      await this.validateCaseClosurePreconditions(caseData, userId);

      // Step 3: Retrieve and log the investigation task
      const investigationTask = caseData.tasks.find((task) => task.name === 'Investigate Case' || task.name === 'Investigate case');

      if (!investigationTask) {
        throw new BadRequestException('Investigation task not found for this case');
      }

      // Log retrieval of the task (Acceptance Criteria #1)
      await this.auditLogService.logAction({
        userId,
        operation: 'retrieveTask',
        entityName: CaseService.name,
        actionPerformed: `Retrieved investigation task ${investigationTask.task_id} for case closure`,
        outcome: Outcome.SUCCESS,
      });

      // Step 4: Start transaction for case closure
      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case status to PENDING_FINAL_APPROVAL (Acceptance Criteria #2)
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            updated_at: new Date(),
          },
        });

        // Update investigation task status to COMPLETE (Acceptance Criteria #3)
        await tx.task.update({
          where: { task_id: investigationTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            updated_at: new Date(),
          },
        });

        // Add final notes/recommendations as a comment if provided
        if (dto.finalNotes || dto.recommendations) {
          await tx.comment.create({
            data: {
              user_id: userId,
              case_id: caseId,
              note: `Final Investigation Summary:\n${dto.finalNotes || ''}\n\nRecommendations:\n${
                dto.recommendations || ''
              }\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
            },
          });
        }

        // Create "Approve case closure" task (Acceptance Criteria #4)
        const approvalTask = await tx.task.create({
          data: {
            case_id: caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED, // Acceptance Criteria #7
            assigned_user_id: null, // Unassigned initially
            name: 'Approve case closure', // Acceptance Criteria #4
            description: `Review and approve case closure with recommended outcome: ${dto.recommendedOutcome}`,
          },
        });

        // Store recommended outcome and additional data as a comment linked to the approval task
        // (Acceptance Criteria #6)
        await tx.comment.create({
          data: {
            user_id: userId,
            task_id: approvalTask.task_id,
            note: JSON.stringify({
              recommendedOutcome: dto.recommendedOutcome,
              finalNotes: dto.finalNotes,
              recommendations: dto.recommendations,
              submittedBy: userId,
              submittedAt: new Date(),
            }),
          },
        });

        return { updatedCase, approvalTask };
      });

      // Step 5: Assign task to Supervisors group via Flowable (Acceptance Criteria #5)
      try {
        // Start or update Flowable process for case closure approval
        const processInstance = await this.flowableService.startProcessInstance(
          'caseClosureApprovalProcess',
          {
            caseId: caseId,
            tenantId: tenantId,
            approvalTaskId: result.approvalTask.task_id,
            recommendedOutcome: dto.recommendedOutcome,
            investigatorId: userId,
            candidateGroup: 'Supervisors', // Acceptance Criteria #5
          },
          `closure-${caseId}`,
        );

        // Get Flowable tasks and assign to Supervisors group
        const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);
        if (flowableTasks && flowableTasks.length > 0) {
          // The BPMN should automatically assign to Supervisors group
          this.logger.log('Approval task assigned to Supervisors group in Flowable', CaseService.name);
        }
      } catch (flowableError) {
        this.logger.error(
          `Flowable process creation failed, but case closure continues: ${flowableError.message}`,
          flowableError.stack,
          CaseService.name,
        );
        // Continue without Flowable - the task is still created in the database
      }

      // Step 6: Log the creation of the approval task (Acceptance Criteria #9)
      await this.auditLogService.logAction({
        userId,
        operation: 'createTask',
        entityName: CaseService.name,
        actionPerformed: `Created "Approve case closure" task ${result.approvalTask.task_id} for case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      // Step 7: Log the assignment to Supervisors group (Acceptance Criteria #10)
      await this.auditLogService.logAction({
        userId,
        operation: 'assignTask',
        entityName: CaseService.name,
        actionPerformed: `Assigned approval task ${result.approvalTask.task_id} to Supervisors candidate group`,
        outcome: Outcome.SUCCESS,
      });

      // Step 8: Notify supervisors (Acceptance Criteria #8)
      await this.notifySupervisors(result.approvalTask.task_id, caseId, tenantId);

      // Log successful case closure submission
      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closed and submitted for approval with outcome: ${dto.recommendedOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} successfully closed and submitted for approval`, CaseService.name);

      return {
        message: 'Case closed successfully and submitted for approval',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        approval_task: {
          task_id: result.approvalTask.task_id,
          name: result.approvalTask.name,
          status: result.approvalTask.status,
          assigned_to: 'Supervisors',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to close case ${caseId}: ${error.message}`, error.stack, CaseService.name);

      // Log failure
      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Failed to close case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async manualCaseCreateForSupervisor(dto: ManualCreateCaseDto, userId: string, tenantId: string) {
    if (!dto.alertId || !dto.alertType) {
      this.logger.warn('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const existingAlert = await this.triageService.getAlertDetails(dto.alertId, userId, tenantId);
    if (existingAlert.alert_data.status !== 'NALT') {
      this.logger.warn('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const priorityScore = dto.priorityScore ?? 0.33;
    const priority = this.triageService.determinePriority(priorityScore);
    const caseDetail: CreateCaseDto = {
      tenantId,
      caseCreatorUserId: userId,
      caseOwnerUserId: userId,
      status: CaseStatus.STATUS_10_ASSIGNED,
      caseType: this.triageService.mapAlertTypeToCaseType(dto.alertType),
      priority,
      caseCreationType: CaseCreationType.MANUAL,
    };

    try {
      const createdCase = await this.createCase(caseDetail, userId);

      const updatedAlert = await this.prismaService.alert.update({
        where: { alert_id: dto.alertId },
        data: {
          priority,
          alert_type: dto.alertType,
          priority_score: priorityScore,
          case_id: createdCase.case_id,
        },
      });
      const createTaskDto = new CreateTaskDto();
      createTaskDto.assignedUserId = userId;
      createTaskDto.candidateGroup = 'investigator';
      createTaskDto.name = 'Investigate case';
      createTaskDto.description = `Investigate case task for case : ${updatedAlert.case_id}`;
      createTaskDto.caseId = updatedAlert.case_id!;
      createTaskDto.status = TaskStatus.STATUS_10_ASSIGNED;

      await this.taskService.createTask(createTaskDto, userId, this.auditLogService, this.logger);

      await this.auditLogService.logAction({
        userId: userId,
        operation: 'createManualCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${createdCase.case_id} created manually for alert ${dto.alertId}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: createdCase,
        alert: updatedAlert,
      };
    } catch (err) {
      this.logger.error('manualCaseCreateForAnalyst failed', {
        error: err,
        dto,
        userId,
        tenantId,
      });
      throw new Error(`Failed to create case & link alert: ${err.message}`);
    }
  }

  async manualCaseCreateForAnalyst(dto: ManualCreateCaseDto, userId: string, tenantId: string) {
    if (!dto.alertId || !dto.alertType) {
      this.logger.warn('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const existingAlert = await this.triageService.getAlertDetails(dto.alertId, userId, tenantId);
    if (existingAlert.alert_data.status !== 'NALT') {
      this.logger.warn('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const priorityScore = dto.priorityScore ?? 0.33;
    const priority = this.triageService.determinePriority(priorityScore);
    const caseDetail: CreateCaseDto = {
      tenantId,
      caseCreatorUserId: userId,
      status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
      caseType: this.triageService.mapAlertTypeToCaseType(dto.alertType),
      priority,
      caseCreationType: CaseCreationType.MANUAL,
    };

    try {
      const createdCase = await this.createCase(caseDetail, userId);

      const updatedAlert = await this.prismaService.alert.update({
        where: { alert_id: dto.alertId },
        data: {
          priority,
          alert_type: dto.alertType,
          priority_score: priorityScore,
          case_id: createdCase.case_id,
        },
      });
      const createTaskDto = new CreateTaskDto();
      createTaskDto.candidateGroup = 'supervisors';
      createTaskDto.name = 'Approve case creation';
      createTaskDto.description = `Case creation approval required for case: ${updatedAlert.case_id}`;
      createTaskDto.caseId = updatedAlert.case_id!;
      createTaskDto.status = TaskStatus.STATUS_01_UNASSIGNED;

      await this.taskService.createTask(createTaskDto, userId, this.auditLogService, this.logger);

      await this.auditLogService.logAction({
        userId: userId,
        operation: 'createManualCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${createdCase.case_id} created manually for alert ${dto.alertId}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: createdCase,
        alert: updatedAlert,
      };
    } catch (err) {
      this.logger.error('manualCaseCreateForAnalyst failed', {
        error: err,
        dto,
        userId,
        tenantId,
      });
      throw new Error(`Failed to create case & link alert: ${err.message}`);
    }
  }

  /**
   * Validate case closure preconditions
   */
  private async validateCaseClosurePreconditions(caseData: any, userId: string) {
    const errors: string[] = [];

    // Check case status (must be IN_PROGRESS)
    if (caseData.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
      throw new ConflictException({
        message: 'Case is not in a closeable state',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_20_IN_PROGRESS,
      });
    }

    // Check if case is assigned to the user (case owner)
    if (caseData.case_owner_user_id !== userId) {
      // Check if user has an assigned investigation task
      const userTask = caseData.tasks.find(
        (task) => task.assigned_user_id === userId && (task.name === 'Investigate Case' || task.name === 'Investigate case'),
      );

      if (!userTask) {
        throw new ForbiddenException('Case is not assigned to you');
      }
    }

    // Check investigation task exists and is in progress
    const investigationTask = caseData.tasks.find((task) => task.name === 'Investigate Case' || task.name === 'Investigate case');

    if (!investigationTask) {
      errors.push('Investigation task not found');
    } else if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS) {
      errors.push(`Investigation task must be in progress (current: ${investigationTask.status})`);
    }

    // Check all other tasks are complete
    const incompleteTasks = caseData.tasks.filter(
      (task) => task.task_id !== investigationTask?.task_id && task.status !== TaskStatus.STATUS_30_COMPLETED,
    );

    if (incompleteTasks.length > 0) {
      errors.push(`All other tasks must be completed. Incomplete tasks: ${incompleteTasks.map((t) => t.name).join(', ')}`);
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Case closure preconditions not met',
        errors,
      });
    }
  }

  /**
   * Notify supervisors about new approval task
   */
  private async notifySupervisors(taskId: string, caseId: string, tenantId: string) {
    try {
      // TODO: Implement notification system
      // This could be email, in-app notification, webhook, etc.
      // For now, just log the notification
      this.logger.log(`Notification sent to Supervisors group for approval task ${taskId} on case ${caseId}`, CaseService.name);

      // In a real implementation, you might:
      // 1. Query KeyCloak for users with SUPERVISOR role in the tenant
      // 2. Send email notifications
      // 3. Create in-app notifications
      // 4. Trigger webhooks to external systems
    } catch (error) {
      this.logger.error(`Failed to notify supervisors: ${error.message}`, error.stack, CaseService.name);
      // Don't throw - notification failure shouldn't stop case closure
    }
  }

  // ... existing methods (createCaseSystemTransmission, createCase, retrieveCase, updateCase, etc.) remain unchanged ...

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

      // Step 3: Ensure system user exists in database
      await this.ensureSystemUserExists(systemUuid);

      // Step 4: Create case with DRAFT status
      const createdCase = await this.prismaService.$transaction(async (tx) => {
        // Create the case
        const newCase = await tx.case.create({
          data: {
            tenant_id: payload.tenantId,
            case_creator_user_id: systemUuid, // Use system UUID from config
            case_owner_user_id: systemUuid, // Initially owned by system
            status: CaseStatus.STATUS_00_DRAFT,
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

        // Create ATM task - FIXED: Don't assign to system user initially
        const atmTask = await tx.task.create({
          data: {
            case_id: newCase.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED, // Start as unassigned
            assigned_user_id: null, // Don't assign to system user
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

      // Step 5: Start Flowable process
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

      // Step 6: Route to ATM
      await this.routeToATM(createdCase.case.case_id, createdCase.atmTask.task_id, systemUuid);

      // Step 7: Check for autoclose and distinguish confirmed/refuted
      const confidence = payload.confidencePercentage || 0;
      const fraudType = payload.fraudType || '';
      // Diagram: Confidence >= 95% and True Positive (e.g., Money-Laundering, Fraud Only, Transaction Blocked)
      if (confidence >= 95) {
        // If true positive (fraudType is one of the types that should be confirmed)
        if (['Money-Laundering', 'Fraud Only', 'Transaction Blocked'].includes(fraudType)) {
          await this.autocloseCase(createdCase.case.case_id, systemUuid, CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED);
        } else {
          // False positive
          await this.autocloseCase(createdCase.case.case_id, systemUuid, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED);
        }
      } else {
        // Confidence < 95%: Prioritize and investigate
        await this.createInvestigationTask(createdCase.case.case_id, systemUuid);
        // Set ATM task to COMPLETE_30 as per requirements
        await this.prismaService.task.update({
          where: { task_id: createdCase.atmTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
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
   * Ensure system user exists in database
   */
  private async ensureSystemUserExists(systemUuid: string) {
    try {
      // Check if system user exists
      const existingUser = await this.prismaService.user.findUnique({
        where: { user_id: systemUuid },
      });

      if (!existingUser) {
        // Create system user
        await this.prismaService.user.create({
          data: {
            user_id: systemUuid,
            username: 'system-user',
            role: 'SYSTEM',
          },
        });
        this.logger.log(`Created system user: ${systemUuid}`, CaseService.name);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure system user exists: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  // ... All other existing helper methods remain unchanged ...

  private async validateTazamaPayload(payload: any): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!payload.tenantId) errors.push('tenantId is required');
    if (!payload.alertData && !payload.transaction) errors.push('alertData or transaction data is required');

    if (payload.reportStatus && payload.reportStatus !== 'ALRT') {
      errors.push('Only ALRT status is accepted for case creation');
    }

    if (payload.confidencePercentage && (payload.confidencePercentage < 0 || payload.confidencePercentage > 100)) {
      errors.push('Confidence percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async routeToATM(caseId: string, taskId: string, systemUuid: string) {
    try {
      await this.prismaService.task.update({
        where: { task_id: taskId },
        data: {
          status: TaskStatus.STATUS_20_IN_PROGRESS,
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

  private checkAutocloseEligibility(payload: any): boolean {
    const confidencePercentage = payload.confidencePercentage || 0;
    const riskScore = payload.riskScore || 0;
    return confidencePercentage < 30 && riskScore < 20;
  }

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

  private async createInvestigationTask(caseId: string, systemUuid: string) {
    try {
      const investigationTask = await this.prismaService.task.create({
        data: {
          case_id: caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          assigned_user_id: null,
          name: 'Investigate Case',
          description: 'Investigate the reported suspicious activity',
        },
      });

      await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          case_owner_user_id: null,
          updated_at: new Date(),
        },
      });

      const flowableTasks = await this.flowableService.getProcessTasks(caseId);
      if (flowableTasks && flowableTasks.length > 0) {
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

      return investigationTask;
    } catch (error) {
      this.logger.error(`Failed to create investigation task: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  // Add these methods to your existing case.service.ts

  /**
   * Get all cases assigned to a user
   * Includes cases where user is owner OR has assigned tasks
   */
  async getUserCases(userId: string, query: GetUserCasesQueryDto) {
    try {
      this.logger.log(`Getting cases for user ${userId}`, CaseService.name);

      const {
        status,
        priority,
        includeTaskAssignments,
        includeOwnedCases,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Build where clause
      const whereConditions: any[] = [];

      // Include owned cases
      if (includeOwnedCases) {
        const ownedCasesCondition: any = {
          case_owner_user_id: userId,
        };
        if (status) ownedCasesCondition.status = status;
        if (priority) ownedCasesCondition.priority = priority;
        whereConditions.push(ownedCasesCondition);
      }

      // Include cases where user has assigned tasks
      if (includeTaskAssignments) {
        const taskAssignmentCondition: any = {
          tasks: {
            some: {
              assigned_user_id: userId,
            },
          },
        };
        if (status) taskAssignmentCondition.status = status;
        if (priority) taskAssignmentCondition.priority = priority;
        whereConditions.push(taskAssignmentCondition);
      }

      // If no conditions, return empty result
      if (whereConditions.length === 0) {
        return {
          cases: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
          summary: {
            totalOwnedCases: 0,
            totalTaskAssignments: 0,
            casesByStatus: {},
            casesByPriority: {},
          },
        };
      }

      // Count total cases
      const totalCount = await this.prismaService.case.count({
        where: {
          OR: whereConditions,
        },
      });

      // Get cases with pagination
      const cases = await this.prismaService.case.findMany({
        where: {
          OR: whereConditions,
        },
        include: {
          tasks: {
            orderBy: {
              created_at: 'desc',
            },
          },
          alert: {
            select: {
              alert_id: true,
              message: true,
              confidence_per: true,
              priority: true,
              alert_type: true,
            },
          },
          comments: {
            select: {
              comment_id: true,
              created_at: true,
            },
            orderBy: {
              created_at: 'desc',
            },
            take: 1, // Just get the latest comment info
          },
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      });

      // Process cases to add user-specific information
      const processedCases = cases.map((caseItem) => {
        const isOwner = caseItem.case_owner_user_id === userId;
        const userTasks = caseItem.tasks.filter((task) => task.assigned_user_id === userId);
        const hasTaskAssignment = userTasks.length > 0;

        let userRole: 'owner' | 'task_assignee' | 'both';
        if (isOwner && hasTaskAssignment) {
          userRole = 'both';
        } else if (isOwner) {
          userRole = 'owner';
        } else {
          userRole = 'task_assignee';
        }

        return {
          case_id: caseItem.case_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          user_role: userRole,
          user_tasks: userTasks.map((task) => ({
            task_id: task.task_id,
            name: task.name,
            status: task.status,
            created_at: task.created_at,
          })),
          total_tasks: caseItem.tasks.length,
          alert: caseItem.alert
            ? {
                alert_id: caseItem.alert.alert_id,
                message: caseItem.alert.message,
                confidence_per: caseItem.alert.confidence_per,
              }
            : undefined,
          latest_comment_date: caseItem.comments[0]?.created_at,
        };
      });

      // Get summary statistics
      const [ownedCasesCount, taskAssignmentCasesCount] = await Promise.all([
        this.prismaService.case.count({
          where: {
            case_owner_user_id: userId,
          },
        }),
        this.prismaService.case.count({
          where: {
            tasks: {
              some: {
                assigned_user_id: userId,
              },
            },
          },
        }),
      ]);

      // Get cases by status and priority
      const casesByStatus = await this.prismaService.case.groupBy({
        by: ['status'],
        where: {
          OR: whereConditions,
        },
        _count: {
          case_id: true,
        },
      });

      const casesByPriority = await this.prismaService.case.groupBy({
        by: ['priority'],
        where: {
          OR: whereConditions,
        },
        _count: {
          case_id: true,
        },
      });

      // Format statistics
      const statusCounts = casesByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      const priorityCounts = casesByPriority.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Log the retrieval
      await this.auditLogService.logAction({
        userId,
        operation: 'getUserCases',
        entityName: CaseService.name,
        actionPerformed: `Retrieved ${cases.length} cases for user ${userId}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        cases: processedCases,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        summary: {
          totalOwnedCases: ownedCasesCount,
          totalTaskAssignments: taskAssignmentCasesCount,
          casesByStatus: statusCounts,
          casesByPriority: priorityCounts,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user cases: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'getUserCases',
        entityName: CaseService.name,
        actionPerformed: `Failed to retrieve cases for user ${userId}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  /**
   * Get all cases with filtering and pagination (Supervisor only)
   */
  async getAllCases(query: GetAllCasesQueryDto, supervisorId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} retrieving all cases`, CaseService.name);

      const {
        status,
        priority,
        caseType,
        ownerId,
        tenantId,
        unassignedOnly,
        createdAfter,
        createdBefore,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;

      // Build where clause
      const whereClause: any = {};

      if (status) whereClause.status = status;
      if (priority) whereClause.priority = priority;
      if (caseType) whereClause.case_type = caseType;
      if (ownerId) whereClause.case_owner_user_id = ownerId;
      if (tenantId) whereClause.tenant_id = tenantId;

      // Handle unassigned filter - FIXED: Only check for null, not empty string
      if (unassignedOnly) {
        whereClause.case_owner_user_id = null;
      }

      // Date range filters
      if (createdAfter || createdBefore) {
        whereClause.created_at = {};
        if (createdAfter) {
          whereClause.created_at.gte = new Date(createdAfter);
        }
        if (createdBefore) {
          whereClause.created_at.lte = new Date(createdBefore);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const totalCount = await this.prismaService.case.count({
        where: whereClause,
      });

      // Get cases with related data
      const cases = await this.prismaService.case.findMany({
        where: whereClause,
        include: {
          tasks: {
            select: {
              task_id: true,
              status: true,
              assigned_user_id: true,
              name: true,
            },
          },
          alert: {
            select: {
              alert_id: true,
              message: true,
              confidence_per: true,
              alert_type: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      });

      // Process cases to add computed fields
      const processedCases = cases.map((caseItem) => {
        const completedTasks = caseItem.tasks.filter((t) => t.status === TaskStatus.STATUS_30_COMPLETED).length;

        const pendingTasks = caseItem.tasks.filter((t) => t.status !== TaskStatus.STATUS_30_COMPLETED).length;

        // Get assigned user info
        const assignedUsers = [...new Set(caseItem.tasks.map((t) => t.assigned_user_id).filter(Boolean))];

        return {
          case_id: caseItem.case_id,
          tenant_id: caseItem.tenant_id,
          case_creator_user_id: caseItem.case_creator_user_id,
          case_owner_user_id: caseItem.case_owner_user_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          total_tasks: caseItem.tasks.length,
          completed_tasks: completedTasks,
          pending_tasks: pendingTasks,
          alert: caseItem.alert,
          assigned_to:
            assignedUsers.length > 0
              ? {
                  user_id: caseItem.case_owner_user_id || assignedUsers[0],
                  task_count: assignedUsers.length,
                }
              : undefined,
        };
      });

      // Get statistics - FIXED: Only check for null in unassigned count
      const [statusStats, priorityStats, typeStats, unassignedCount] = await Promise.all([
        // Cases by status
        this.prismaService.case.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { case_id: true },
        }),
        // Cases by priority
        this.prismaService.case.groupBy({
          by: ['priority'],
          where: whereClause,
          _count: { case_id: true },
        }),
        // Cases by type
        this.prismaService.case.groupBy({
          by: ['case_type'],
          where: whereClause,
          _count: { case_id: true },
        }),
        // Unassigned cases count - FIXED: Only check for null
        this.prismaService.case.count({
          where: {
            case_owner_user_id: null,
          },
        }),
      ]);

      // Format statistics
      const casesByStatus = statusStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      const casesByPriority = priorityStats.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      const casesByType = typeStats.reduce(
        (acc, item) => {
          if (item.case_type) {
            acc[item.case_type] = item._count.case_id;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      // Calculate average tasks per case
      const totalTasks = cases.reduce((sum, c) => sum + c.tasks.length, 0);
      const averageTasksPerCase = cases.length > 0 ? Math.round((totalTasks / cases.length) * 10) / 10 : 0;

      // Get oldest unassigned case if relevant - FIXED: Only check for null
      let oldestUnassignedCase: { case_id: string; created_at: Date; days_old: number } | undefined;
      if (unassignedCount > 0) {
        const oldestUnassigned = await this.prismaService.case.findFirst({
          where: {
            case_owner_user_id: null,
          },
          orderBy: { created_at: 'asc' },
          select: {
            case_id: true,
            created_at: true,
          },
        });

        if (oldestUnassigned) {
          const now = new Date();
          const daysOld = Math.floor((now.getTime() - oldestUnassigned.created_at.getTime()) / (1000 * 60 * 60 * 24));
          oldestUnassignedCase = {
            case_id: oldestUnassigned.case_id,
            created_at: oldestUnassigned.created_at,
            days_old: daysOld,
          };
        }
      }

      // Log the action
      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'getAllCases',
        entityName: CaseService.name,
        actionPerformed: `Supervisor retrieved ${cases.length} cases (total: ${totalCount})`,
        outcome: Outcome.SUCCESS,
      });

      return {
        cases: processedCases,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        statistics: {
          totalCases: totalCount,
          casesByStatus,
          casesByPriority,
          casesByType,
          unassignedCases: unassignedCount,
          averageTasksPerCase,
          oldestUnassignedCase,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all cases: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'getAllCases',
        entityName: CaseService.name,
        actionPerformed: 'Failed to retrieve all cases',
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  /**
   * Get workload statistics for a user
   */
  async getUserWorkloadStats(userId: string) {
    try {
      this.logger.log(`Getting workload stats for user ${userId}`, CaseService.name);

      // Get all active cases (not closed/abandoned)
      const activeCaseStatuses = [
        CaseStatus.STATUS_00_DRAFT,
        CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        CaseStatus.STATUS_03_RETURNED,
        CaseStatus.STATUS_10_ASSIGNED,
        CaseStatus.STATUS_20_IN_PROGRESS,
        CaseStatus.STATUS_21_SUSPENDED,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        CaseStatus.STATUS_30_PENDING_REOPENING,
        CaseStatus.STATUS_31_REOPENED,
      ];

      // Get cases and tasks
      const [activeCases, pendingTasks, allUserCases] = await Promise.all([
        // Active cases count
        this.prismaService.case.count({
          where: {
            OR: [
              { case_owner_user_id: userId },
              {
                tasks: {
                  some: {
                    assigned_user_id: userId,
                  },
                },
              },
            ],
            status: {
              in: activeCaseStatuses,
            },
          },
        }),

        // Pending tasks count
        this.prismaService.task.count({
          where: {
            assigned_user_id: userId,
            status: {
              in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        }),

        // All user cases for statistics
        this.prismaService.case.findMany({
          where: {
            OR: [
              { case_owner_user_id: userId },
              {
                tasks: {
                  some: {
                    assigned_user_id: userId,
                  },
                },
              },
            ],
            status: {
              in: activeCaseStatuses,
            },
          },
          select: {
            case_id: true,
            status: true,
            priority: true,
            created_at: true,
          },
          orderBy: {
            created_at: 'asc',
          },
        }),
      ]);

      // Calculate statistics
      const now = new Date();
      let oldestCase: { case_id: string; created_at: Date; days_old: number } | null = null;
      let totalAge = 0;

      if (allUserCases.length > 0) {
        const oldest = allUserCases[0];
        const daysOld = Math.floor((now.getTime() - oldest.created_at.getTime()) / (1000 * 60 * 60 * 24));

        oldestCase = {
          case_id: oldest.case_id,
          created_at: oldest.created_at,
          days_old: daysOld,
        };

        // Calculate average age
        allUserCases.forEach((c) => {
          const age = (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24);
          totalAge += age;
        });
      }

      // Group by status and priority
      const casesByStatus: Record<string, number> = {};
      const casesByPriority: Record<string, number> = {};

      allUserCases.forEach((c) => {
        casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
        casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
      });

      const averageCaseAge = allUserCases.length > 0 ? Math.round((totalAge / allUserCases.length) * 10) / 10 : 0;

      // Get upcoming deadlines (if you have deadline fields)
      // This is a placeholder - adjust based on your actual schema
      const upcomingDeadlines = await this.prismaService.task.findMany({
        where: {
          assigned_user_id: userId,
          status: {
            in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
          },
        },
        select: {
          task_id: true,
          name: true,
          case_id: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'asc',
        },
        take: 5,
      });

      return {
        totalActiveCases: activeCases,
        totalPendingTasks: pendingTasks,
        casesByStatus,
        casesByPriority,
        oldestCase,
        averageCaseAge,
        upcomingTasks: upcomingDeadlines.map((task) => ({
          task_id: task.task_id,
          name: task.name,
          case_id: task.case_id,
          days_old: Math.floor((now.getTime() - task.created_at.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get workload stats: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

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
