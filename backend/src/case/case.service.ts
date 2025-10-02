import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { CaseStatus, TaskStatus, Priority, CaseCreationType } from '@prisma/client';
import { GetUserCasesQueryDto } from './dto/get-user-cases.dto';
import { GetAllCasesQueryDto } from './dto/get-all-cases.dto';
import { ManualCreateCaseDto } from './dto/manual-case-create.dto';
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
   * Close a case and submit for supervisor approval
   */
  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string) {
    try {
      this.logger.log(`Closing case ${caseId} by user ${userId}`, CaseService.name);

      // Retrieve the case and validate preconditions
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

      // Validate case closure preconditions
      await this.validateCaseClosurePreconditions(caseData, userId);

      // Retrieve and log the investigation task
      const investigationTask = caseData.tasks.find((task) => task.name === 'Investigate Case' || task.name === 'Investigate case');

      if (!investigationTask) {
        throw new BadRequestException('Investigation task not found for this case');
      }

      // Log retrieval of the task
      await this.auditLogService.logAction({
        userId,
        operation: 'retrieveTask',
        entityName: CaseService.name,
        actionPerformed: `Retrieved investigation task ${investigationTask.task_id} for case closure`,
        outcome: Outcome.SUCCESS,
      });

      // Start transaction for case closure
      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case status to PENDING_FINAL_APPROVAL
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            updated_at: new Date(),
          },
        });

        // Update investigation task status to COMPLETE
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

        // Create "Approve case closure" task
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

      // Assign task to Supervisors group via Flowable
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

      // Log the creation of the approval task
      await this.auditLogService.logAction({
        userId,
        operation: 'createTask',
        entityName: CaseService.name,
        actionPerformed: `Created "Approve case closure" task ${result.approvalTask.task_id} for case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      // Log the assignment to Supervisors group
      await this.auditLogService.logAction({
        userId,
        operation: 'assignTask',
        entityName: CaseService.name,
        actionPerformed: `Assigned approval task ${result.approvalTask.task_id} to Supervisors candidate group`,
        outcome: Outcome.SUCCESS,
      });

      // Notify supervisors
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

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    if (!dto.alertId || !dto.alertType) {
      this.logger.error('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const existingAlert = await this.triageService.getAlertDetails(dto.alertId, tenantId, userId);
    if (existingAlert.case_id) {
      this.logger.error(`Case already exists for alertId ${dto.alertId}`, '', CaseService.name);
      throw new BadRequestException(`Case already exists for alertId ${dto.alertId}`);
    }

    const alertStatus = (existingAlert.alert_data as any)?.status;
    if (alertStatus !== 'NALT') {
      this.logger.error('Cannot create Case: alert_data.status is not NALT', '', CaseService.name);
      throw new BadRequestException('Cannot create Case: alert_data.status is not NALT');
    }

    const priorityScore = dto.priorityScore ?? 0.33;
    const priority = this.triageService.determinePriority(priorityScore);
    const caseType = this.triageService.mapAlertTypeToCaseType(dto.alertType);

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const caseDetail: CreateCaseDto = {
          tenantId,
          caseCreatorUserId: userId,
          caseOwnerUserId: role === 'SUPERVISOR' ? userId : undefined,
          status: role === 'SUPERVISOR' ? CaseStatus.STATUS_10_ASSIGNED : CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          caseType,
          priority,
          caseCreationType: CaseCreationType.MANUAL,
        };

        const createdCase = await this.createCase(caseDetail, userId);

        const updatedAlert = await prisma.alert.update({
          where: { alert_id: dto.alertId },
          data: {
            priority,
            alert_type: dto.alertType,
            priority_score: priorityScore,
            case_id: createdCase.case_id,
          },
        });

        const createTaskDto = new CreateTaskDto();
        createTaskDto.caseId = updatedAlert.case_id!;
        createTaskDto.name = role === 'SUPERVISOR' ? 'Investigate case' : 'Approve case creation';
        createTaskDto.description =
          role === 'SUPERVISOR'
            ? `Investigate case task for case: ${updatedAlert.case_id}`
            : `Case creation approval required for case: ${updatedAlert.case_id}`;
        createTaskDto.status = role === 'SUPERVISOR' ? TaskStatus.STATUS_10_ASSIGNED : TaskStatus.STATUS_01_UNASSIGNED;

        if (role === 'SUPERVISOR') {
          createTaskDto.candidateGroup = 'investigator';
          createTaskDto.assignedUserId = userId;
        } else {
          createTaskDto.candidateGroup = 'supervisors';
        }

        await this.prismaService.task.create({
          data: {
            case_id: createTaskDto.caseId,
            name: createTaskDto.name,
            description: createTaskDto.description,
            status: createTaskDto.status,
            candidateGroup: createTaskDto.candidateGroup,
            assigned_user_id: createTaskDto.assignedUserId ?? null,
          },
        });

        await this.flowableService.startProcessInstance(
          'manualCaseCreationProcess',
          {
            caseId: createdCase.case_id,
            tenantId,
            role,
            caseCreatorUserId: userId,
            priority,
            caseType,
          },
          createdCase.case_id,
        );

        await this.auditLogService.logAction({
          userId,
          operation: 'createManualCase',
          entityName: CaseService.name,
          actionPerformed: `Case ${createdCase.case_id} created manually for alert`,
          outcome: Outcome.SUCCESS,
        });

        return { case: createdCase, alert: updatedAlert };
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('manualCaseCreate failed', { error: err, dto, userId, tenantId });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${err.message}`);
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
      // Log the notification (placeholder for real notification system)
      this.logger.log(`Notification sent to Supervisors group for approval task ${taskId} on case ${caseId}`, CaseService.name);

      //notify supervisors via email, in-app, or webhook
    } catch (error) {
      this.logger.error(`Failed to notify supervisors: ${error.message}`, error.stack, CaseService.name);
      // Don't throw - notification failure shouldn't stop case closure
    }
  }


  /**
   * System-to-system case creation entry point
   */
  async createCaseSystemTransmission(payload: any, clientId: string) {
    try {
      this.logger.log('System-to-system case creation initiated', CaseService.name);
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', clientId);
      await this.ensureSystemUserExists(systemUuid);
      await this.triageService.processIncomingAlert(payload, systemUuid, payload.tenantId || clientId);
      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: `Case creation triggered via system transmission`,
        outcome: Outcome.SUCCESS,
      });
      return { message: 'Case creation triggered via system transmission' };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  /**
   * Ensure system user exists in database
   */
  private async ensureSystemUserExists(systemUuid: string) {
    try {
      // Use the underlying Prisma client from the PrismaService (cast to any to satisfy TypeScript)
      const prismaClient: any = (this.prismaService as any);

      // Check if system user exists
      const existingUser = await prismaClient.user.findUnique({
        where: { user_id: systemUuid },
      });

      if (!existingUser) {
        // Create system user
        await prismaClient.user.create({
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
            take: 1,
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
