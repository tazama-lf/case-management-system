import { Injectable, BadRequestException, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma, CaseStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthHelperService } from '../auth/auth-helper.service';
import { NotificationService } from 'src/notification/notification.service';
import { WorkQueueService } from '../work-queue/work-queue.service';
import { RuleEngineService } from '../work-queue/rule-engine.service';
import { RuleTrigger } from '../work-queue/dto/assignment-rule.dto';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
  CaseStatusChangedEvent,
} from '../events/domain-events';
export interface TaskWithCase extends Task {
  case: {
    case_id: string;
    priority: string;
    status: string;
    created_at: Date;
  };
}

@Injectable()
export class TaskService {
  private readonly systemUserId: string;

  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly authHelperService: AuthHelperService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => WorkQueueService))
    private readonly workQueueService: WorkQueueService,
    @Inject(forwardRef(() => RuleEngineService))
    private readonly ruleEngineService: RuleEngineService,
  ) {
    this.systemUserId = this.configService.get<string>('SYSTEM_UUID', 'system-user');
  }

  async createTask(taskDTO: CreateTaskDto, userId: string, auditLogService: AuditLogService, loggerService: LoggerService) {
    loggerService.log('Creating task', TaskService.name);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const caseData = await tx.case.findUnique({
          where: { case_id: taskDTO.caseId },
          select: {
            tenant_id: true,
            priority: true,
            status: true,
          },
        });

        if (!caseData) {
          throw new NotFoundException(`Case ${taskDTO.caseId} not found`);
        }

        const taskData: Prisma.TaskCreateInput = {
          case: {
            connect: { case_id: taskDTO.caseId },
          },
          status: taskDTO.status || TaskStatus.STATUS_01_UNASSIGNED,
          name: taskDTO.name,
          description: taskDTO.description,
          candidateGroup: taskDTO.candidateGroup,
        };

        if (taskDTO.assignedUserId) {
          taskData.assigned_user_id = taskDTO.assignedUserId;
        }

        const task = await tx.task.create({
          data: taskData,
        });

        return { task, tenantId: caseData.tenant_id, caseData };
      });

      let updatedTask = result.task;
      try {
        const rules = await this.workQueueService.getAllActiveAssignmentRules(result.tenantId);

        if (rules.length > 0) {
          const applicableRules = rules.filter((rule) => rule.trigger_type === RuleTrigger.TASK_CREATED);

          if (applicableRules.length > 0) {
            const taskWithCase = {
              ...updatedTask,
              case: {
                case_id: result.task.case_id,
                priority: result.caseData.priority,
                status: result.caseData.status,
                created_at: new Date(),
                updated_at: new Date(),
              },
            };

            const matchingRules = this.ruleEngineService.findMatchingRules(applicableRules, taskWithCase as any, {});

            if (matchingRules.length > 0) {
              const firstMatchingRule = matchingRules[0];
              loggerService.log(
                `Applying assignment rule ${firstMatchingRule.assignment_rule_id} to task ${updatedTask.task_id}`,
                TaskService.name,
              );

              const ruleApplication = this.ruleEngineService.applyRule(firstMatchingRule, taskWithCase as any);

              const updateData: any = {};
              if (ruleApplication.workQueueId) {
                updateData.work_queue_id = ruleApplication.workQueueId;
              }
              if (ruleApplication.assignedUserId) {
                updateData.assigned_user_id = ruleApplication.assignedUserId;
              }
              if (ruleApplication.slaDurationHours) {
                updateData.sla_duration_hours = ruleApplication.slaDurationHours;
                const slaDeadline = new Date();
                slaDeadline.setHours(slaDeadline.getHours() + ruleApplication.slaDurationHours);
                updateData.sla_deadline = slaDeadline;
              }

              if (Object.keys(updateData).length > 0) {
                updatedTask = await this.prisma.task.update({
                  where: { task_id: updatedTask.task_id },
                  data: updateData,
                });

                await this.prisma.workQueueAssignmentRule.update({
                  where: { assignment_rule_id: firstMatchingRule.assignment_rule_id },
                  data: {
                    application_count: { increment: 1 },
                    last_applied_at: new Date(),
                  },
                });

                this.eventEmitter.emit('task.auto-assigned', {
                  taskId: updatedTask.task_id,
                  ruleId: firstMatchingRule.assignment_rule_id,
                  ruleName: firstMatchingRule.rule_name,
                  workQueueId: ruleApplication.workQueueId,
                  assignedUserId: ruleApplication.assignedUserId,
                });

                await auditLogService.logAction({
                  userId: this.systemUserId,
                  actionPerformed: `Auto-assigned task ${updatedTask.task_id} using rule ${firstMatchingRule.rule_name} (${firstMatchingRule.assignment_rule_id})`,
                  entityName: 'TaskAutoAssignment',
                  operation: 'RULE_APPLIED',
                  outcome: Outcome.SUCCESS,
                  performedAt: new Date(),
                });

                loggerService.log(`Successfully applied assignment rule to task ${updatedTask.task_id}`, TaskService.name);
              }
            }
          }
        }
      } catch (ruleError: any) {
        loggerService.error(
          `Error applying assignment rules to task ${updatedTask.task_id}: ${ruleError.message}`,
          ruleError,
          TaskService.name,
        );
        await auditLogService.logAction({
          userId: this.systemUserId,
          actionPerformed: `Failed to auto-assign task ${updatedTask.task_id}: ${ruleError.message}`,
          entityName: 'TaskAutoAssignment',
          operation: 'RULE_APPLIED',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }

      this.eventEmitter.emit(
        'task.created',
        new TaskCreatedEvent(
          updatedTask.task_id,
          taskDTO.caseId,
          taskDTO.name,
          taskDTO.description || '',
          taskDTO.candidateGroup || 'Investigations',
          updatedTask.status,
          updatedTask.assigned_user_id ?? undefined,
        ),
      );

      auditLogService.logAction({
        userId,
        actionPerformed: `Created task ${updatedTask.task_id}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return {
        ...updatedTask,
        candidateGroup: taskDTO.candidateGroup,
      };
    } catch (error) {
      loggerService.error('Error creating task', error, TaskService.name);
      auditLogService.logAction({
        userId,
        actionPerformed: 'Error creating task',
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
      throw error;
    }
  }

  async reassignTask(taskId: string, userId: string, tenantId: string, assignedUserId: string) {
    this.logger.log(`Reassigning task ${taskId} to user ${assignedUserId}`, TaskService.name);

    try {
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        throw new BadRequestException(`Task ${taskId} not found`);
      }

      if (existingTask.status === TaskStatus.STATUS_30_COMPLETED) {
        throw new BadRequestException(`Task ${taskId} is already completed`);
      }

      const userExists = await this.authHelperService.userExists(assignedUserId);
      if (!userExists) {
        const msg = `User ${assignedUserId} not found in Keycloak`;
        await this.auditLogService.logAction({
          userId,
          actionPerformed: msg,
          entityName: TaskService.name,
          operation: 'reassignTask',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
        this.logger.warn(msg, TaskService.name);
        throw new BadRequestException(msg);
      }

      const GROUP_ROLE_MAP: Record<string, string> = {
        supervisors: 'CMS_SUPERVISOR',
        investigators: 'CMS_INVESTIGATOR',
        investigations: 'CMS_INVESTIGATOR',
        analysts: 'CMS_ANALYST',
      };

      const group = existingTask.candidateGroup?.toLowerCase() || '';
      const requiredRole = GROUP_ROLE_MAP[group];

      if (requiredRole) {
        const hasRole = await this.authHelperService.userHasRole(assignedUserId, requiredRole);
        if (!hasRole) {
          const msg = `User ${assignedUserId} lacks required role (${requiredRole}) for group ${group}`;
          await this.auditLogService.logAction({
            userId,
            actionPerformed: msg,
            entityName: TaskService.name,
            operation: 'reassignTask',
            outcome: Outcome.FAILURE,
            performedAt: new Date(),
          });
          this.logger.warn(msg, TaskService.name);
          throw new ForbiddenException(msg);
        }
      }

      const previousAssignedUserId = existingTask.assigned_user_id;
      const wasUnassigned = !previousAssignedUserId;
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: assignedUserId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          updated_at: new Date(),
        },
      });

      this.eventEmitter.emit(
        'task.assigned',
        new TaskAssignedEvent(taskId, updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined),
      );

      if (existingTask.status !== TaskStatus.STATUS_10_ASSIGNED) {
        this.eventEmitter.emit(
          'task.status.changed',
          new TaskStatusChangedEvent(
            taskId,
            updatedTask.case_id,
            existingTask.name || '',
            existingTask.status,
            TaskStatus.STATUS_10_ASSIGNED,
            assignedUserId,
          ),
        );
      }

      try {
        await this.notificationService.sendNotification({
          userId: assignedUserId,
          type: 'TASK_ASSIGNED',
          message: `Task "${existingTask.name || taskId}" has been assigned to you`,
          metadata: {
            taskId,
            caseId: updatedTask.case_id,
            taskName: existingTask.name,
            assignedBy: userId,
            candidateGroup: existingTask.candidateGroup,
          },
        });

        if (previousAssignedUserId) {
          await this.notificationService.sendNotification({
            userId: previousAssignedUserId,
            type: 'TASK_REASSIGNED',
            message: `Task "${existingTask.name || taskId}" has been reassigned to another user`,
            metadata: {
              taskId,
              caseId: updatedTask.case_id,
              taskName: existingTask.name,
              reassignedTo: assignedUserId,
              reassignedBy: userId,
            },
          });
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send reassignment notifications: ${notificationError.message}`, TaskService.name);
      }

      await this.auditLogService.logAction({
        userId,
        actionPerformed: wasUnassigned
          ? `Assigned unassigned task ${taskId} to ${assignedUserId}`
          : `Reassigned task ${taskId} from ${previousAssignedUserId} to ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'reassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(
        wasUnassigned
          ? `Task ${taskId} successfully assigned to ${assignedUserId}`
          : `Task ${taskId} successfully reassigned from ${previousAssignedUserId} to ${assignedUserId}`,
        TaskService.name,
      );

      return {
        ...updatedTask,
        message: wasUnassigned
          ? `Task successfully assigned to user ${assignedUserId}`
          : `Task successfully reassigned from user ${previousAssignedUserId} to ${assignedUserId}`,
        previousAssignee: previousAssignedUserId,
        newAssignee: assignedUserId,
      };
    } catch (error) {
      this.logger.error(`Error reassigning task ${taskId}: ${error.message}`, error, TaskService.name);
      throw error;
    }
  }

  async updateTask(taskId: string, updateData: Partial<UpdateTaskDto>, userId: string, auditLogService: AuditLogService | null) {
    this.logger.log(`Updating task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.prisma.task.findUnique({
        where: { task_id: taskId },
      });

      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const updateInput: Prisma.TaskUpdateInput = {
        status: updateData.status,
        name: updateData.name,
        description: updateData.description,
      };

      if (updateData.assignedUserId !== undefined) {
        if (updateData.assignedUserId) {
          updateInput.assigned_user_id = updateData.assignedUserId;
        } else {
          updateInput.assigned_user_id = null;
        }
      }

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: updateInput,
      });

      if (updateData.status && updateData.status !== existingTask.status) {
        this.eventEmitter.emit(
          'task.status.changed',
          new TaskStatusChangedEvent(
            taskId,
            updatedTask.case_id,
            updatedTask.name || '',
            existingTask.status,
            updateData.status,
            updatedTask.assigned_user_id || undefined,
          ),
        );
      }

      if (updateData.assignedUserId !== undefined && updateData.assignedUserId !== existingTask.assigned_user_id) {
        if (updateData.assignedUserId) {
          this.eventEmitter.emit(
            'task.assigned',
            new TaskAssignedEvent(taskId, updatedTask.case_id, updateData.assignedUserId, existingTask.assigned_user_id || undefined),
          );
        } else {
          this.eventEmitter.emit(
            'task.unassigned',
            new TaskUnassignedEvent(taskId, updatedTask.case_id, existingTask.assigned_user_id || undefined),
          );
        }
      }

      this.logger.log(`Task updated: ${updatedTask.task_id}`, TaskService.name);

      const auditService = auditLogService || this.auditLogService;
      auditService.logAction({
        userId,
        actionPerformed: `Updated task ${taskId}`,
        entityName: TaskService.name,
        operation: 'updateTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error updating task ${taskId}`, error, TaskService.name);

      const auditService = auditLogService || this.auditLogService;
      auditService.logAction({
        userId,
        actionPerformed: `Error updating task ${taskId}: ${JSON.stringify(updateData)}`,
        entityName: TaskService.name,
        operation: 'updateTask',
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
      throw error;
    }
  }

  async getTasksByCandidateGroup(candidateGroup: string, userId: string) {
    this.logger.log(`Retrieving tasks for candidateGroup: ${candidateGroup}`, TaskService.name);

    try {
      const dbTasks = (await this.prisma.task.findMany({
        where: {
          candidateGroup: candidateGroup,
          status: {
            in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
          },
        },
        include: {
          case: {
            select: {
              case_id: true,
              priority: true,
              status: true,
              created_at: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      })) as TaskWithCase[];

      this.auditLogService.logAction({
        userId,
        operation: 'getTasksByCandidateGroup',
        entityName: TaskService.name,
        actionPerformed: `Successfully retrieved ${dbTasks.length} tasks for candidateGroup: ${candidateGroup}`,
        outcome: Outcome.SUCCESS,
      });

      return dbTasks;
    } catch (error) {
      this.logger.error(`Error retrieving tasks for candidateGroup: ${candidateGroup}`, error, TaskService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'getTasksByCandidateGroup',
        entityName: TaskService.name,
        actionPerformed: `Error retrieving tasks for candidateGroup: ${candidateGroup}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  async getInvestigationQueue() {
    try {
      const dbTasks: TaskWithCase[] = (await this.prisma.task.findMany({
        where: {
          candidateGroup: 'investigations',
          status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED] },
        },
        include: {
          case: true,
        },
        orderBy: { created_at: 'desc' },
      })) as any;

      return dbTasks;
    } catch (error) {
      this.logger.error('Error retrieving investigation queue', error, TaskService.name);
      throw error;
    }
  }

  async getTasksByCaseId(caseId: string, userId?: string) {
    this.logger.log('Retrieving tasks by case', TaskService.name);

    try {
      const tasks = await this.prisma.task.findMany({
        where: { case_id: caseId },
        include: {
          case: {
            select: {
              case_id: true,
              status: true,
              priority: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Successfully retrieved tasks for case: ${caseId}`,
          outcome: Outcome.SUCCESS,
          performedAt: new Date(),
        });
      }

      return tasks;
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Error retrieving tasks for case: ${caseId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }

  async assignTaskToInvestigator(taskId: string, assignedUserId: string, supervisorId: string, tenantId: string) {
    this.logger.log(`[AssignTask] Supervisor ${supervisorId} assigning task ${taskId} to investigator ${assignedUserId}`, TaskService.name);

    if (!assignedUserId) {
      this.logger.error('[AssignTask] Assigned user ID is null or undefined', null, TaskService.name);
      throw new BadRequestException('Assigned user ID cannot be null or undefined');
    }

    this.logger.log(`[AssignTask] Looking up user ${assignedUserId} in auth service`, TaskService.name);

    try {
      const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(assignedUserId);
      this.logger.log(`[AssignTask] Found roles for user ${assignedUserId}: ${investigatorRoles.join(', ')}`, TaskService.name);

      if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
        this.logger.error(
          `[AssignTask] User ${assignedUserId} does not have INVESTIGATOR role. Current roles: ${investigatorRoles.join(', ')}`,
          null,
          TaskService.name,
        );
        throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
      }

      this.logger.log(`[AssignTask] User ${assignedUserId} has CMS_INVESTIGATOR role`, TaskService.name);
    } catch (error) {
      this.logger.error(`[AssignTask] Failed to get roles for user ${assignedUserId}: ${error.message}`, error.stack, TaskService.name);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`User ${assignedUserId} not found`);
    }

    try {
      this.logger.log(`[AssignTask] Fetching task ${taskId} details`, TaskService.name);

      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        this.logger.error(`[AssignTask] Task ${taskId} not found`, null, TaskService.name);
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      this.logger.log(
        `[AssignTask] Task ${taskId} found. Current status: ${existingTask.status}, Current assignee: ${existingTask.assigned_user_id || 'None'}, Case: ${existingTask.case_id}`,
        TaskService.name,
      );

      const previousAssignedUserId = existingTask.assigned_user_id;

      const existingCase = await this.prisma.case.findUnique({
        where: { case_id: existingTask.case_id },
        select: { status: true, case_id: true },
      });

      if (!existingCase) {
        throw new NotFoundException(`Case ${existingTask.case_id} not found`);
      }

      const previousCaseStatus = existingCase.status;

      this.logger.log(`[AssignTask] Current case status: ${previousCaseStatus}. Will update to STATUS_10_ASSIGNED`, TaskService.name);

      this.logger.log(`[AssignTask] Updating task ${taskId} and case ${existingTask.case_id} in transaction`, TaskService.name);

      const result = await this.prisma.$transaction(async (tx) => {
        // Update the task
        const updatedTask = await tx.task.update({
          where: { task_id: taskId },
          data: {
            assigned_user_id: assignedUserId,
            status: TaskStatus.STATUS_10_ASSIGNED,
            updated_at: new Date(),
          },
        });

        const updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: {
            status: CaseStatus.STATUS_10_ASSIGNED,
            case_owner_user_id: assignedUserId,
            updated_at: new Date(),
          },
        });

        return { updatedTask, updatedCase };
      });

      this.logger.log(
        `[AssignTask] Task ${taskId} successfully updated. New status: ${result.updatedTask.status}, New assignee: ${result.updatedTask.assigned_user_id}`,
        TaskService.name,
      );

      this.logger.log(
        `[AssignTask] Case ${existingTask.case_id} successfully updated. New status: ${result.updatedCase.status}, New owner: ${result.updatedCase.case_owner_user_id}`,
        TaskService.name,
      );

      this.logger.log(`[AssignTask] Emitting task.assigned event for task ${taskId}`, TaskService.name);

      this.eventEmitter.emit(
        'task.assigned',
        new TaskAssignedEvent(taskId, result.updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined),
      );

      this.logger.log(`[AssignTask] Emitting case.status.changed event for case ${existingTask.case_id}`, TaskService.name);

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          existingTask.case_id,
          previousCaseStatus,
          CaseStatus.STATUS_10_ASSIGNED,
          `Case assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`,
        ),
      );

      this.logger.log(`[AssignTask] Logging audit actions for task ${taskId} assignment`, TaskService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        actionPerformed: `Assigned task ${taskId} to investigator ${assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`,
        entityName: TaskService.name,
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      await this.auditLogService.logAction({
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} assigned to investigator ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(
        `[AssignTask] Task ${taskId} successfully assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`,
        TaskService.name,
      );

      return result.updatedTask;
    } catch (error) {
      this.logger.error(`[AssignTask] Error assigning task ${taskId}: ${error.message}`, error.stack, TaskService.name);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Failed to assign task: ${error.message}`);
    }
  }

  async getTasks(status?: string) {
    try {
      const where = status ? { status: status as TaskStatus } : {};
      return await this.prisma.task.findMany({
        where,
        include: {
          case: {
            select: {
              case_id: true,
              status: true,
              priority: true,
              created_at: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      throw error;
    }
  }

  async getTaskById(taskId: string) {
    try {
      return await this.prisma.task.findUnique({
        where: { task_id: taskId },
        include: {
          case: {
            select: {
              case_id: true,
              status: true,
              priority: true,
              created_at: true,
            },
          },
          comments: {
            orderBy: { created_at: 'desc' },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Error retrieving task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async getWorkQueue(filters: {
    role?: string;
    candidateGroup?: string;
    page?: number;
    limit?: number;
    unassignedOnly?: boolean;
    assignedToMe?: string;
  }) {
    try {
      const { candidateGroup, page = 1, limit = 20, unassignedOnly = false, assignedToMe } = filters;

      const whereClause: any = {
        status: {
          in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
        },
      };

      if (candidateGroup) {
        whereClause.candidateGroup = candidateGroup;
      }

      if (unassignedOnly) {
        whereClause.assigned_user_id = null;
      } else if (assignedToMe) {
        whereClause.assigned_user_id = assignedToMe;
      }

      const totalCount = await this.prisma.task.count({ where: whereClause });

      const start = (page - 1) * limit;
      const dbTasks = (await this.prisma.task.findMany({
        where: whereClause,
        include: {
          case: {
            select: {
              case_id: true,
              priority: true,
              status: true,
              created_at: true,
            },
          },
        },
        skip: start,
        take: limit,
        orderBy: { created_at: 'desc' },
      })) as TaskWithCase[];

      const tasks = dbTasks.map((task) => ({
        taskId: task.task_id,
        name: task.name,
        description: task.description,
        status: task.status,
        assignedUser: task.assigned_user_id,
        candidateGroup: task.candidateGroup,
        case: task.case,
        created: task.created_at,
      }));

      return {
        tasks,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      this.logger.error('Error retrieving work queue', error, TaskService.name);
      throw error;
    }
  }

  async getWorkQueueStatistics(userId: string) {
    try {
      const candidateGroups = ['supervisors', 'investigations', 'analysts'];
      const statistics: Record<string, any> = {};

      for (const group of candidateGroups) {
        const tasks = await this.prisma.task.findMany({
          where: {
            candidateGroup: group,
            status: {
              in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        });

        statistics[group] = {
          total: tasks.length,
          unassigned: tasks.filter((t) => !t.assigned_user_id).length,
          assigned: tasks.filter((t) => t.assigned_user_id).length,
        };
      }

      const userTasks = await this.prisma.task.findMany({
        where: {
          assigned_user_id: userId,
          status: {
            in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
          },
        },
      });

      return {
        queues: statistics,
        userStats: {
          totalAssigned: userTasks.length,
          byStatus: userTasks.reduce((acc: any, task) => {
            const status = task.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      this.logger.error('Error getting work queue statistics', error, TaskService.name);
      throw error;
    }
  }

  async claimTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
    this.logger.log(`User ${userId} claiming task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const previousAssignedUserId = existingTask.assigned_user_id;

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: userId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      this.eventEmitter.emit(
        'task.assigned',
        new TaskAssignedEvent(taskId, updatedTask.case_id, userId, previousAssignedUserId || undefined),
      );

      const auditService = auditLogService || this.auditLogService;
      auditService.logAction({
        userId,
        actionPerformed: `Claimed task ${taskId}`,
        entityName: TaskService.name,
        operation: 'claimTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error claiming task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async unassignTask(taskId: string, userId: string, tenantId: string, reason?: string) {
    this.logger.log(`User ${userId} attempting to unassign task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        const msg = `Task ${taskId} not found`;
        await this.auditLogService.logAction({
          userId,
          actionPerformed: msg,
          entityName: TaskService.name,
          operation: 'unassignTask',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
        throw new NotFoundException(msg);
      }

      if (existingTask.status === TaskStatus.STATUS_30_COMPLETED) {
        const msg = `Cannot unassign a completed task (${taskId})`;
        await this.auditLogService.logAction({
          userId,
          actionPerformed: msg,
          entityName: TaskService.name,
          operation: 'unassignTask',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
        throw new BadRequestException(msg);
      }

      if (!existingTask.assigned_user_id) {
        const msg = `Task ${taskId} is already unassigned`;
        await this.auditLogService.logAction({
          userId,
          actionPerformed: msg,
          entityName: TaskService.name,
          operation: 'unassignTask',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
        throw new BadRequestException(msg);
      }

      const GROUP_ROLE_MAP: Record<string, string> = {
        supervisors: 'CMS_SUPERVISOR',
        investigators: 'CMS_INVESTIGATOR',
        investigations: 'CMS_INVESTIGATOR',
        analysts: 'CMS_ANALYST',
      };

      const candidateGroup = existingTask.candidateGroup?.toLowerCase() || '';
      const requiredRole = GROUP_ROLE_MAP[candidateGroup];

      if (requiredRole) {
        const hasRole = await this.authHelperService.userHasRole(userId, requiredRole);
        if (!hasRole) {
          const msg = `User ${userId} lacks required role (${requiredRole}) to unassign tasks in group ${candidateGroup}`;
          await this.auditLogService.logAction({
            userId,
            actionPerformed: msg,
            entityName: TaskService.name,
            operation: 'unassignTask',
            outcome: Outcome.FAILURE,
            performedAt: new Date(),
          });
          this.logger.warn(msg, TaskService.name);
          throw new ForbiddenException(msg);
        }
      }

      const originalAssignee = existingTask.assigned_user_id;

      if (!reason || reason.trim().length === 0) {
        const msg = 'Reason for unassigning task is required';
        await this.auditLogService.logAction({
          userId,
          actionPerformed: msg,
          entityName: TaskService.name,
          operation: 'unassignTask',
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
        throw new BadRequestException(msg);
      }

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: null,
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
      });

      this.eventEmitter.emit(
        'task.unassigned',
        new TaskUnassignedEvent(taskId, updatedTask.case_id, originalAssignee || undefined, candidateGroup, reason),
      );

      try {
        // Notify the original assignee
        if (originalAssignee) {
          await this.notificationService.sendNotification({
            userId: originalAssignee,
            type: 'TASK_UNASSIGNED',
            message: `Task "${existingTask.name || taskId}" has been unassigned. Reason: ${reason}`,
            metadata: {
              taskId,
              caseId: existingTask.case_id,
              unassignedBy: userId,
              reason,
              candidateGroup,
            },
          });
        }

        if (candidateGroup) {
          await this.notificationService.sendGroupNotification({
            candidateGroup,
            type: 'TASK_AVAILABLE',
            message: `Task "${existingTask.name || taskId}" is now available in the ${candidateGroup} work queue`,
            metadata: {
              taskId,
              caseId: existingTask.case_id,
              unassignmentReason: reason,
            },
          });
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send notifications for task unassignment: ${notificationError.message}`, TaskService.name);
      }

      await this.auditLogService.logAction({
        userId,
        actionPerformed: `Unassigned task ${taskId} from user ${originalAssignee}. Task returned to group: ${candidateGroup}. Reason: ${reason}`,
        entityName: TaskService.name,
        operation: 'unassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(`Task ${taskId} successfully unassigned and returned to ${candidateGroup} work queue`, TaskService.name);

      return {
        ...updatedTask,
        message: `Task successfully unassigned and returned to ${candidateGroup} work queue`,
        candidateGroup,
        unassignmentReason: reason,
      };
    } catch (error) {
      this.logger.error(`Error unassigning task ${taskId}: ${error.message}`, error.stack, TaskService.name);

      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      await this.auditLogService.logAction({
        userId,
        actionPerformed: `Failed to unassign task ${taskId}: ${error.message}`,
        entityName: TaskService.name,
        operation: 'unassignTask',
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });

      throw new BadRequestException(`Failed to unassign task: ${error.message}`);
    }
  }

  async releaseTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
    this.logger.log(`User ${userId} releasing task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const previousAssignedUserId = existingTask.assigned_user_id;

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: null,
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
        include: {
          case: true,
        },
      });

      this.eventEmitter.emit(
        'task.unassigned',
        new TaskUnassignedEvent(taskId, updatedTask.case_id, previousAssignedUserId || undefined, existingTask.candidateGroup || undefined),
      );

      const auditService = auditLogService || this.auditLogService;
      auditService.logAction({
        userId,
        actionPerformed: `Released task ${taskId}`,
        entityName: TaskService.name,
        operation: 'releaseTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error releasing task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async completeTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
    this.logger.log(`User ${userId} completing task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          status: TaskStatus.STATUS_30_COMPLETED,
        },
        include: {
          case: true,
        },
      });

      this.eventEmitter.emit(
        'task.status.changed',
        new TaskStatusChangedEvent(
          taskId,
          updatedTask.case_id,
          updatedTask.name || '',
          existingTask.status,
          TaskStatus.STATUS_30_COMPLETED,
          updatedTask.assigned_user_id || undefined,
        ),
      );

      const auditService = auditLogService || this.auditLogService;
      auditService.logAction({
        userId,
        actionPerformed: `Completed task ${taskId}`,
        entityName: TaskService.name,
        operation: 'completeTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error completing task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async getUserTasks(userId: string, includeCompleted: boolean = false) {
    try {
      const statusFilter = includeCompleted
        ? {}
        : {
            status: {
              not: TaskStatus.STATUS_30_COMPLETED,
            },
          };

      return await this.prisma.task.findMany({
        where: {
          assigned_user_id: userId,
          ...statusFilter,
        },
        include: {
          case: {
            select: {
              case_id: true,
              status: true,
              priority: true,
              created_at: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error retrieving tasks for user ${userId}`, error, TaskService.name);
      throw error;
    }
  }

  /**
   * Reassign a task to a different work queue
   * Validates permissions, updates task, emits events, and logs audit trail
   */
  async reassignTaskToWorkQueue(
    taskId: string,
    targetWorkQueueId: string,
    userId: string,
    tenantId: string,
    reason?: string,
    assignedUserId?: string,
  ) {
    this.logger.log(`Reassigning task ${taskId} to work queue ${targetWorkQueueId}`, TaskService.name);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({
          where: { task_id: taskId },
          include: {
            workQueue: {
              select: {
                work_queue_id: true,
                name: true,
              },
            },
            case: {
              select: {
                case_id: true,
                tenant_id: true,
                status: true,
              },
            },
          },
        });

        if (!task) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }

        if (task.case.tenant_id !== tenantId) {
          throw new ForbiddenException('Task does not belong to your organization');
        }

        if (task.status === TaskStatus.STATUS_20_IN_PROGRESS && task.assigned_user_id) {
          throw new BadRequestException('Cannot reassign task that is currently in progress. Please unassign or complete the task first.');
        }

        const targetQueue = await tx.workQueue.findUnique({
          where: { work_queue_id: targetWorkQueueId },
          select: {
            work_queue_id: true,
            name: true,
            tenant_id: true,
            is_active: true,
          },
        });

        if (!targetQueue) {
          throw new NotFoundException(`Target work queue ${targetWorkQueueId} not found`);
        }

        if (targetQueue.tenant_id !== tenantId) {
          throw new ForbiddenException('Target work queue does not belong to your organization');
        }

        if (!targetQueue.is_active) {
          throw new BadRequestException(`Target work queue '${targetQueue.name}' is not active`);
        }

        if (task.work_queue_id === targetWorkQueueId) {
          throw new BadRequestException(`Task is already in work queue '${targetQueue.name}'`);
        }

        if (assignedUserId) {
          const memberAssignment = await tx.workQueueMember.findUnique({
            where: {
              work_queue_id_user_id: {
                work_queue_id: targetWorkQueueId,
                user_id: assignedUserId,
              },
            },
          });

          if (!memberAssignment) {
            throw new BadRequestException(`User ${assignedUserId} is not assigned to target work queue '${targetQueue.name}'`);
          }
        }

        const oldWorkQueueId = task.work_queue_id;
        const oldWorkQueueName = task.workQueue?.name || null;
        const previousAssignedUserId = task.assigned_user_id || undefined;

        const updateData: any = {
          work_queue_id: targetWorkQueueId,
          updated_at: new Date(),
        };

        if (assignedUserId) {
          updateData.assigned_user_id = assignedUserId;
          updateData.status = TaskStatus.STATUS_10_ASSIGNED;
        } else if (task.assigned_user_id) {
          updateData.assigned_user_id = null;
          updateData.status = TaskStatus.STATUS_01_UNASSIGNED;
        }

        const updatedTask = await tx.task.update({
          where: { task_id: taskId },
          data: updateData,
        });

        const auditDescription = reason
          ? `Reassigned task from '${oldWorkQueueName || 'unassigned'}' to '${targetQueue.name}'. Reason: ${reason}`
          : `Reassigned task from '${oldWorkQueueName || 'unassigned'}' to '${targetQueue.name}'`;

        await this.auditLogService.logAction({
          userId,
          actionPerformed: auditDescription,
          entityName: 'Task',
          operation: 'REASSIGN_TASK',
          outcome: Outcome.SUCCESS,
          performedAt: new Date(),
        });

        this.eventEmitter.emit('task.reassigned', {
          taskId: task.task_id,
          caseId: task.case_id,
          taskName: task.name || 'Unnamed Task',
          oldWorkQueueId,
          newWorkQueueId: targetWorkQueueId,
          oldWorkQueueName,
          newWorkQueueName: targetQueue.name,
          reassignedBy: userId,
          tenantId,
          reason,
          assignedUserId,
          previousAssignedUserId,
          timestamp: new Date(),
        });

        this.logger.log(
          `Task ${taskId} successfully reassigned from '${oldWorkQueueName || 'unassigned'}' to '${targetQueue.name}'`,
          TaskService.name,
        );

        return {
          taskId: updatedTask.task_id,
          oldWorkQueueId,
          oldWorkQueueName,
          newWorkQueueId: targetQueue.work_queue_id,
          newWorkQueueName: targetQueue.name,
          status: updatedTask.status,
          assignedUserId: updatedTask.assigned_user_id || undefined,
          reason,
          reassignedAt: updatedTask.updated_at,
          reassignedBy: userId,
        };
      });
    } catch (error) {
      this.logger.error(`Error reassigning task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }
}
