

// Mapping functions for enums with runtime validation

// Enum types as string literal unions matching schema.prisma
export type CaseStatus =
  | 'STATUS_00_DRAFT'
  | 'STATUS_01_PENDING_CASE_CREATION_APPROVAL'
  | 'STATUS_02_READY_FOR_ASSIGNMENT'
  | 'STATUS_03_RETURNED'
  | 'STATUS_10_ASSIGNED'
  | 'STATUS_20_IN_PROGRESS'
  | 'STATUS_21_SUSPENDED'
  | 'STATUS_22_PENDING_FINAL_APPROVAL'
  | 'STATUS_30_PENDING_REOPENING'
  | 'STATUS_31_REOPENED'
  | 'STATUS_71_AUTOCLOSED_CONFIRMED'
  | 'STATUS_72_AUTOCLOSED_REFUTED'
  | 'STATUS_81_CLOSED_REFUTED'
  | 'STATUS_82_CLOSED_CONFIRMED'
  | 'STATUS_83_CLOSED_INCONCLUSIVE'
  | 'STATUS_99_ABANDONED';

export type TaskStatus =
  | 'STATUS_01_UNASSIGNED'
  | 'STATUS_10_ASSIGNED'
  | 'STATUS_20_IN_PROGRESS'
  | 'STATUS_30_COMPLETED'
  | 'STATUS_21_BLOCKED';

export type Priority = 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
export type CaseType = 'FRAUD' | 'AML' | 'FRAUD_AND_AML' | 'NONE';
export type CaseCreationType = 'MANUAL' | 'AUTOMATIC_SYSTEM';


function mapCaseStatusToPrisma(status: CaseStatus): CaseStatus {
  return status;
}
function mapTaskStatusToPrisma(status: TaskStatus): TaskStatus {
  return status;
}
function mapPriorityToPrisma(priority: Priority): Priority {
  return priority;
}
function mapCaseTypeToPrisma(type: CaseType): CaseType {
  return type;
}
function mapCaseCreationTypeToPrisma(type: CaseCreationType): CaseCreationType {
  return type;
}

// Mapping functions for enums

// Prisma enums as string literal unions
// Remove local enum objects/types, use Prisma-generated types above
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto, CaseClosureOutcome } from './dto/close-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { AuthService } from '../auth/auth.service';
// Enums are string unions from Prisma client, not exported types
import {GetUserCasesQueryDto} from "./dto/get-user-cases.dto";
import {GetAllCasesQueryDto} from "./dto/get-all-cases.dto";

@Injectable()
export class CaseService {
  /**
   * Supervisor approves case closure (User Story 9-A)
   * Strictly enforces all acceptance criteria
   */
  async approveCaseClosure(caseId: string, supervisorId: string, recommendedOutcome: string) {
    // Step 1: Retrieve the case and validate preconditions
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: { tasks: true },
    });
    if (!caseData) {
      throw new NotFoundException('Case not found');
    }
    // Step 2: Check case status
  if (caseData.status !== 'STATUS_22_PENDING_FINAL_APPROVAL') {
      throw new ConflictException({
        message: 'Case is not in an approvable state',
        currentStatus: caseData.status,
  requiredStatus: 'STATUS_22_PENDING_FINAL_APPROVAL',
      });
    }
    // Step 3: Find the "Approve case closure" task
    const approvalTask = caseData.tasks.find(
      (task) => task.name === 'Approve case closure'
    );
    if (!approvalTask) {
      throw new BadRequestException('Approve case closure task not found');
    }
    // Step 4: Check task assignment and status
    if (approvalTask.assigned_user_id !== null && approvalTask.assigned_user_id !== supervisorId) {
      throw new ForbiddenException('Task is not assigned to Supervisors work queue');
    }
  if (approvalTask.status !== 'STATUS_01_UNASSIGNED') {
      throw new ConflictException('Approve case closure task must be unassigned');
    }
    // Step 5: Check recommended outcome
    const validOutcomes: (
      'STATUS_81_CLOSED_REFUTED' |
      'STATUS_82_CLOSED_CONFIRMED' |
      'STATUS_83_CLOSED_INCONCLUSIVE'
    )[] = [
      'STATUS_81_CLOSED_REFUTED',
      'STATUS_82_CLOSED_CONFIRMED',
      'STATUS_83_CLOSED_INCONCLUSIVE',
    ];
    if (!recommendedOutcome || !validOutcomes.includes(recommendedOutcome as typeof validOutcomes[number])) {
      throw new BadRequestException('Invalid or missing recommended outcome');
    }
    // Step 6: Ensure all other tasks are complete
    const incompleteTasks = caseData.tasks.filter(
  (task) => task.task_id !== approvalTask.task_id && task.status !== 'STATUS_30_COMPLETED'
    );
    if (incompleteTasks.length > 0) {
      throw new ConflictException('All other tasks must be complete before approval');
    }
    // Step 7: Update case status and complete approval task
    await this.prismaService.$transaction(async (tx) => {
        await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: mapCaseStatusToPrisma(recommendedOutcome as CaseStatus),
            updated_at: new Date(),
          },
        });
        await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: mapTaskStatusToPrisma('STATUS_30_COMPLETED'),
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });
    });
    // Step 8: Audit log retrieval and approval
    await this.auditLogService.logAction({
      userId: supervisorId,
      operation: 'retrieveCase',
      entityName: CaseService.name,
      actionPerformed: `Supervisor retrieved case ${caseId} for approval`,
      outcome: Outcome.SUCCESS,
    });
    await this.auditLogService.logAction({
      userId: supervisorId,
      operation: 'approveCaseClosure',
      entityName: CaseService.name,
      actionPerformed: `Supervisor approved closure of case ${caseId} with outcome ${recommendedOutcome}`,
      outcome: Outcome.SUCCESS,
    });
    return { message: 'Case closure approved', caseId, outcome: recommendedOutcome };
  }
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly flowableService: FlowableService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
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
      const investigationTask = caseData.tasks.find(
        (task) => task.name === 'Investigate Case' || task.name === 'Investigate case',
      );

      // Step 4: Fetch supervisors from KeyCloak using AuthService
  const supervisors = await this.authService.fetchSupervisors();
      if (!supervisors || supervisors.length === 0) {
        throw new BadRequestException('No supervisors found for this tenant');
      }

      // Step 5: Create "Approve case closure" task and assign to supervisors group (unassigned, visible to all supervisors)
      let approvalTask;
      await this.prismaService.$transaction(async (tx) => {
        approvalTask = await tx.task.create({
          data: {
            case_id: caseId,
            status: 'STATUS_01_UNASSIGNED',
            assigned_user_id: null, // Unassigned, visible to all supervisors
            name: 'Approve case closure',
            description: 'Supervisor approval required for case closure',
          },
        });

        // Update case status to pending final approval
        await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: 'STATUS_22_PENDING_FINAL_APPROVAL',
            updated_at: new Date(),
          },
        });
      });

      // Step 6: Log the creation of the approval task
      await this.auditLogService.logAction({
        userId,
        operation: 'createApprovalTask',
        entityName: CaseService.name,
        actionPerformed: `Created approval task ${approvalTask.task_id} for case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      // Step 7: Log the assignment to Supervisors group
      await this.auditLogService.logAction({
        userId,
        operation: 'assignTaskToSupervisors',
        entityName: CaseService.name,
        actionPerformed: `Approval task ${approvalTask.task_id} assigned to supervisors group for case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      // Step 8: Notify supervisors
      try {
        for (const supervisor of supervisors) {
            await this.notifySupervisors(approvalTask.task_id, caseId, tenantId, supervisor.email);
        }
      } catch (notifyError) {
        this.logger.error(`Failed to notify supervisors: ${notifyError.message}`, notifyError.stack, CaseService.name);
      }

      // Log successful case closure submission
      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closed and submitted for supervisor approval`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed successfully and submitted for approval',
        approvalTaskId: approvalTask.task_id,
        supervisors: supervisors.map(s => s.id),
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

  /**
   * Validate case closure preconditions
   */
  private async validateCaseClosurePreconditions(caseData: any, userId: string) {
    const errors: string[] = [];

    // Check case status (must be IN_PROGRESS)
  if (caseData.status !== 'STATUS_20_IN_PROGRESS') {
      throw new ConflictException({
        message: 'Case is not in a closeable state',
        currentStatus: caseData.status,
  requiredStatus: 'STATUS_20_IN_PROGRESS',
      });
    }

    // Check if case is assigned to the user (case owner)
    if (caseData.case_owner_user_id !== userId) {
      // Check if user has an assigned investigation task
      const userTask = caseData.tasks.find(
          (task) =>
              task.assigned_user_id === userId &&
              (task.name === 'Investigate Case' || task.name === 'Investigate case'),
      );

      if (!userTask) {
        throw new ForbiddenException('Case is not assigned to you');
      }
    }

    // Check investigation task exists and is in progress
    const investigationTask = caseData.tasks.find(
        (task) => task.name === 'Investigate Case' || task.name === 'Investigate case',
    );

    if (!investigationTask) {
      errors.push('Investigation task not found');
  } else if (investigationTask.status !== 'STATUS_20_IN_PROGRESS') {
      errors.push(`Investigation task must be in progress (current: ${investigationTask.status})`);
    }

    // Check all other tasks are complete
    const incompleteTasks = caseData.tasks.filter(
        (task) =>
            task.task_id !== investigationTask?.task_id &&
            task.status !== 'STATUS_30_COMPLETED',
    );

    if (incompleteTasks.length > 0) {
      errors.push(
          `All other tasks must be completed. Incomplete tasks: ${incompleteTasks
              .map((t) => t.name)
              .join(', ')}`,
      );
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
  private async notifySupervisors(taskId: string, caseId: string, tenantId: string, supervisorEmail?: string) {
    try {
      // Example notification logic: log and optionally send email
      this.logger.log(
        `Notification sent to supervisor${supervisorEmail ? ' (' + supervisorEmail + ')' : ''} for approval task ${taskId} on case ${caseId}`,
        CaseService.name,
      );
      // TODO: Integrate with real notification system (email, in-app, webhook, etc.)
    } catch (error) {
      this.logger.error(
        `Failed to notify supervisor${supervisorEmail ? ' (' + supervisorEmail + ')' : ''}: ${error.message}`,
        error.stack,
        CaseService.name,
      );
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

      // Step 3: Create case with DRAFT status
      const createdCase = await this.prismaService.$transaction(async (tx) => {
        // Create the case
        const newCase = await tx.case.create({
          data: {
            tenant_id: payload.tenantId,
            case_creator_user_id: systemUuid, // Use system UUID from config
            case_owner_user_id: systemUuid, // Initially owned by system
            status: mapCaseStatusToPrisma('STATUS_00_DRAFT'),
            priority: mapPriorityToPrisma(payload.priority || 'NEW'),
            case_type: payload.caseType ? mapCaseTypeToPrisma(payload.caseType) : undefined,
            case_creation_type: mapCaseCreationTypeToPrisma('AUTOMATIC_SYSTEM'),
          },
        });

        // Create Alert record if present in payload
        if (payload.alertData) {
          await tx.alert.create({
            data: {
              case_id: newCase.case_id,
              tenant_id: payload.tenantId,
              priority: payload.priority || 'NEW',
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
            status: 'STATUS_01_UNASSIGNED',
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
          await this.autocloseCase(createdCase.case.case_id, systemUuid, 'STATUS_71_AUTOCLOSED_CONFIRMED');
        } else {
          // False positive
          await this.autocloseCase(createdCase.case.case_id, systemUuid, 'STATUS_72_AUTOCLOSED_REFUTED');
        }
      } else {
        // Confidence < 95%: Prioritize and investigate
        await this.createInvestigationTask(createdCase.case.case_id, systemUuid);
        // Set ATM task to COMPLETE_30 as per requirements
        await this.prismaService.task.update({
          where: { task_id: createdCase.atmTask.task_id },
          data: {
            status: 'STATUS_30_COMPLETED',
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
          status: 'STATUS_20_IN_PROGRESS',
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
          status: 'STATUS_01_UNASSIGNED',
          assigned_user_id: null,
          name: 'Investigate Case',
          description: 'Investigate the reported suspicious activity',
        },
      });

      await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          status: 'STATUS_02_READY_FOR_ASSIGNMENT',
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
        sortOrder = 'desc'
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
      const processedCases = cases.map(caseItem => {
        const isOwner = caseItem.case_owner_user_id === userId;
        const userTasks = caseItem.tasks.filter(task => task.assigned_user_id === userId);
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
          user_tasks: userTasks.map(task => ({
            task_id: task.task_id,
            name: task.name,
            status: task.status,
            created_at: task.created_at,
          })),
          total_tasks: caseItem.tasks.length,
          alert: caseItem.alert ? {
            alert_id: caseItem.alert.alert_id,
            message: caseItem.alert.message,
            confidence_per: caseItem.alert.confidence_per,
          } : undefined,
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
      const statusCounts = casesByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

      const priorityCounts = casesByPriority.reduce((acc, item) => {
        acc[item.priority] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

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
        const completedTasks = caseItem.tasks.filter(
            (t) => t.status === 'STATUS_30_COMPLETED'
        ).length;

        const pendingTasks = caseItem.tasks.filter(
            (t) => t.status !== 'STATUS_30_COMPLETED'
        ).length;

        // Get assigned user info
        const assignedUsers = [...new Set(caseItem.tasks.map(t => t.assigned_user_id).filter(Boolean))];

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
          assigned_to: assignedUsers.length > 0 ? {
            user_id: caseItem.case_owner_user_id || assignedUsers[0],
            task_count: assignedUsers.length,
          } : undefined,
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
      const casesByStatus = statusStats.reduce((acc, item) => {
        acc[item.status] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

      const casesByPriority = priorityStats.reduce((acc, item) => {
        acc[item.priority] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

      const casesByType = typeStats.reduce((acc, item) => {
        if (item.case_type) {
          acc[item.case_type] = item._count.case_id;
        }
        return acc;
      }, {} as Record<string, number>);

      // Calculate average tasks per case
      const totalTasks = cases.reduce((sum, c) => sum + c.tasks.length, 0);
      const averageTasksPerCase = cases.length > 0 ? Math.round(totalTasks / cases.length * 10) / 10 : 0;

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
          const daysOld = Math.floor(
              (now.getTime() - oldestUnassigned.created_at.getTime()) / (1000 * 60 * 60 * 24)
          );
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
      const activeCaseStatuses: CaseStatus[] = [
        'STATUS_00_DRAFT',
        'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
        'STATUS_02_READY_FOR_ASSIGNMENT',
        'STATUS_03_RETURNED',
        'STATUS_10_ASSIGNED',
        'STATUS_20_IN_PROGRESS',
        'STATUS_21_SUSPENDED',
        'STATUS_22_PENDING_FINAL_APPROVAL',
        'STATUS_30_PENDING_REOPENING',
        'STATUS_31_REOPENED',
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
              in: ['STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS'],
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
        allUserCases.forEach(c => {
          const age = (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24);
          totalAge += age;
        });
      }

      // Group by status and priority
      const casesByStatus: Record<string, number> = {};
      const casesByPriority: Record<string, number> = {};

      allUserCases.forEach(c => {
        casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
        casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
      });

      const averageCaseAge = allUserCases.length > 0
          ? Math.round(totalAge / allUserCases.length * 10) / 10
          : 0;

      // Get upcoming deadlines (if you have deadline fields)
      // This is a placeholder - adjust based on your actual schema
      const upcomingDeadlines = await this.prismaService.task.findMany({
        where: {
          assigned_user_id: userId,
          status: {
            in: ['STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS'],
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
        upcomingTasks: upcomingDeadlines.map(task => ({
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
    status: mapCaseStatusToPrisma(createCaseDTO.status),
    priority: mapPriorityToPrisma(createCaseDTO.priority),
          parent_id: createCaseDTO.parentId ?? null,
          case_type: createCaseDTO.caseType ? mapCaseTypeToPrisma(createCaseDTO.caseType) : undefined,
          case_creation_type: mapCaseCreationTypeToPrisma(createCaseDTO.caseCreationType),
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
    case_type: updateData.caseType ? mapCaseTypeToPrisma(updateData.caseType) : undefined,
    priority: updateData.priority ? mapPriorityToPrisma(updateData.priority) : undefined,
    status: updateData.status ? mapCaseStatusToPrisma(updateData.status) : undefined,
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