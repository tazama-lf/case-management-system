import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { Outcome } from '../../utils/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma, CaseStatus } from '@prisma/client-cms';
import { NotificationService } from 'src/modules/notification/notification.service';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
  CaseStatusChangedEvent,
} from '../events/domain-events';
import { TaskLifecycleService } from './services/task-lifecycle.service';
import { TaskRepository } from '../repository/task.repository';
import { FlowableService } from '../flowable/flowable.service';
import { TaskBridgeService } from '../task-bridge/task-bridge.service';
import { AuthService } from '../auth/auth.service';

export interface TaskWithCase extends Task {
  case: {
    case_id: number;
    priority: string;
    status: string;
    created_at: Date;
  };
}

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationService: NotificationService,
    private readonly lifecycle: TaskLifecycleService,
    private readonly flowableService: FlowableService,
    private readonly taskBridgeService: TaskBridgeService,
    private readonly authService: AuthService,
  ) {}

  async createTask(taskDTO: CreateTaskDto, userId: string) {
    return this.taskBridgeService.createTask(taskDTO, userId);
  }
  async reassignTask(taskId: number, userId: string, tenantId: string, assignedUserId: string, notes: string) {
    return this.lifecycle.reassignTask(taskId, userId, tenantId, assignedUserId, notes);
  }

  async updateTask(taskId: number, updateData: Partial<UpdateTaskDto>, userId: string) {
    this.logger.log(`Start - Update Task: ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.taskRepository.findTaskWithCase(taskId);

      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const updateInput: Prisma.TaskUpdateInput = {
        status: updateData.status,
        description: updateData.description,
        assigned_user_id: updateData.assignedUserId != existingTask.assigned_user_id ? updateData.assignedUserId : existingTask.assigned_user_id,
        investigationNotes: updateData.investigationNotes,
      };

      const statusChanged = updateData.status !== undefined && updateData.status !== existingTask.status;
      const shouldPromoteCaseToInProgress =
        statusChanged &&
        updateData.status === TaskStatus.STATUS_20_IN_PROGRESS &&
        (existingTask.name === 'Investigate Case' || existingTask.name === 'Investigate Fraud' || existingTask.name === 'Investigate AML');

      let updatedTask: Task;
      let caseStatusTransition: { previous: CaseStatus; next: CaseStatus } | null = null;
      if (shouldPromoteCaseToInProgress) {
        const txResult = await this.taskRepository.transaction(async (tx) => {
          const taskRecord = await this.taskRepository.updateTask(taskId, updateInput, tx);

          const caseRecord = await this.taskRepository.findCaseStatus(taskRecord.case_id, tx);
          if (!caseRecord) throw new NotFoundException(`Case ${taskRecord.case_id} not found`);

          if (this.isCaseEligibleForInProgress(caseRecord.status)) {
            const assigneeId = taskRecord.assigned_user_id || existingTask.assigned_user_id || null;
            const caseUpdateData: Prisma.CaseUpdateInput = { status: CaseStatus.STATUS_20_IN_PROGRESS };
            if (assigneeId && caseRecord.case_owner_user_id !== assigneeId) caseUpdateData.case_owner_user_id = assigneeId;
            await this.taskRepository.updateCase(taskRecord.case_id, caseUpdateData, tx);

            await this.flowableService.handleTaskAssigned({
              taskId: taskRecord.task_id,
              caseId: taskRecord.case_id,
              assignedUserId: taskRecord.assigned_user_id || existingTask.assigned_user_id!,
              taskName: existingTask.name!,
            });

            return { taskRecord, previousCaseStatus: caseRecord.status, updatedCaseStatus: CaseStatus.STATUS_20_IN_PROGRESS };
          }

          return { taskRecord, previousCaseStatus: caseRecord.status, updatedCaseStatus: caseRecord.status };
        });

        updatedTask = txResult.taskRecord;
        if (txResult.updatedCaseStatus !== txResult.previousCaseStatus) {
          caseStatusTransition = { previous: txResult.previousCaseStatus, next: txResult.updatedCaseStatus };
        }
      } else {
        // update task in db
        updatedTask = await this.taskRepository.updateTask(taskId, updateInput);

        // Check if task is being completed and is fraud/AML investigation
        if (updateData.status === TaskStatus.STATUS_30_COMPLETED) {
          if (existingTask.name === 'Investigate Fraud') {
            await this.flowableService.handleTaskCompleted({
              caseId: updatedTask.case_id,
              taskName: 'Investigate Fraud',
              newStatus: TaskStatus.STATUS_30_COMPLETED,
              completionVariables: {
                fraudInvestigationAction: 'complete',
                fraudRecommendedOutcome: updateData.recommendedOutcome,
                fraudInvestigationNotes: updateData.finalNotes,
              },
            });
          }

          if (existingTask.name === 'Investigate AML') {
            await this.flowableService.handleTaskCompleted({
              caseId: updatedTask.case_id,
              taskName: 'Investigate AML',
              newStatus: TaskStatus.STATUS_30_COMPLETED,
              completionVariables: {
                amlInvestigationAction: 'complete',
                amlRecommendedOutcome: updateData.recommendedOutcome,
                amlInvestigationNotes: updateData.finalNotes,
              },
            });
          }
        } else {
          await this.flowableService.handleTaskAssigned({
            taskId: updatedTask.task_id,
            caseId: updatedTask.case_id,
            assignedUserId: updateData.assignedUserId || existingTask.assigned_user_id!,
            taskName: existingTask.name!,
          });
        }
      }
      this.logger.log(`Task updated: ${updatedTask.task_id}`, TaskService.name);

      this.auditLogService.logAction({
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

      this.auditLogService.logAction({
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
      const dbTasks = (await this.taskRepository.findTasks(
        {
          candidateGroup: candidateGroup,
          status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
        },
        true,
      )) as TaskWithCase[];

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
      const dbTasks: TaskWithCase[] = (await this.taskRepository.findTasks(
        { candidateGroup: 'investigations', status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED] } },
        true,
      )) as any;

      return dbTasks;
    } catch (error) {
      this.logger.error('Error retrieving investigation queue', error, TaskService.name);
      throw error;
    }
  }

  async getTasksByCaseId(caseId: number, userId?: string, userClaims: string[] = []) {
    this.logger.log('Retrieving tasks by case', TaskService.name);

    try {
      const tasks = await this.taskRepository.findTasks({ case_id: caseId }, true);

      const isComplianceOfficer = userClaims.includes('CMS_COMPLIANCE_OFFICER');

      const filteredTasks = tasks.filter((task) => {
        const isComplianceTask = task.candidateGroup?.toLowerCase() === 'compliance';

        if (isComplianceOfficer) {
          return isComplianceTask;
        }

        return !isComplianceTask;
      });

      const enrichedTasks = await Promise.all(
        filteredTasks.map(async (task) => {
          let assignedUser: { user_id: string; username: string; role?: string } | null = null;

          if (task.assigned_user_id) {
            try {
              const userInfo = await this.authService.getUserDetailsFromAuthService(task.assigned_user_id);
              assignedUser = {
                user_id: task.assigned_user_id,
                username: userInfo.username || userInfo.email || task.assigned_user_id,
                role: userInfo.roles[0],
              };
            } catch (error: any) {
              this.logger.warn(`Could not fetch user info for ${task.assigned_user_id}: ${error.message}`, TaskService.name);
              // Fallback to just the user ID
              assignedUser = {
                user_id: task.assigned_user_id,
                username: task.assigned_user_id.substring(0, 8),
              };
            }
          }

          return {
            ...task,
            assignedUser,
          };
        }),
      );


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

      return enrichedTasks;
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

  async assignTaskToInvestigator(taskId: number, assignedUserId: string, supervisorId: string, tenantId: string, note?: string) {
    return this.lifecycle.assignTaskToInvestigator(taskId, assignedUserId, supervisorId, tenantId, note);
  }

  async selfAssignTask(taskId: number, investigatorUserId: string, tenantId: string) {
    return this.lifecycle.selfAssignTask(taskId, investigatorUserId, tenantId);
  }

  async getTasks(status?: string) {
    try {
      const where = status ? { status: status as TaskStatus } : {};
      return await this.taskRepository.findTasks(where, true);
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      throw error;
    }
  }

  async getTaskById(taskId: number) {
    try {
      return await this.taskRepository.findTaskWithCase(taskId);
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

      const totalCount = await this.taskRepository.countTasks(whereClause);

      const start = (page - 1) * limit;
      const dbTasks = (await this.taskRepository.findTasks(whereClause, true, start, limit)) as TaskWithCase[];

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
      const candidateGroups = ['Supervisors', 'Investigations', 'Investigator'];
      const statistics: Record<string, any> = {};

      for (const group of candidateGroups) {
        const tasks = await this.taskRepository.findTasks(
          {
            candidateGroup: group,
            status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
          },
          false,
        );

        statistics[group] = {
          total: tasks.length,
          unassigned: tasks.filter((t) => !t.assigned_user_id).length,
          assigned: tasks.filter((t) => t.assigned_user_id).length,
        };
      }

      const userTasks = await this.taskRepository.findTasks(
        {
          assigned_user_id: userId,
          status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
        },
        false,
      );

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

  async claimTask(taskId: number, userId: string, auditLogService?: AuditLogService) {
    this.logger.log(`User ${userId} claiming task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.taskRepository.findTaskById(taskId);
      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const previousAssignedUserId = existingTask.assigned_user_id;

      const updatedTask = await this.taskRepository.updateTask(taskId, {
        assigned_user_id: userId,
        status: TaskStatus.STATUS_10_ASSIGNED,
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

  async unassignTask(taskId: number, userId: string, tenantId: string, reason?: string) {
    return this.lifecycle.unassignTask(taskId, userId, tenantId, reason || '');
  }

  // async releaseTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
  //   return this.lifecycle.releaseTask(taskId, userId);
  // }

  async completeTask(taskId: number, userId: string, auditLogService?: AuditLogService) {
    return this.lifecycle.completeTask(taskId, userId);
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

      return await this.taskRepository.findTasks({ assigned_user_id: userId, ...statusFilter }, true);
    } catch (error) {
      this.logger.error(`Error retrieving tasks for user ${userId}`, error, TaskService.name);
      throw error;
    }
  }

  async reassignTaskToWorkQueue(
    taskId: number,
    targetWorkQueueId: number,
    userId: string,
    tenantId: string,
    reason?: string,
    assignedUserId?: string,
  ) {
    return this.lifecycle.reassignTaskToWorkQueue(taskId, targetWorkQueueId, userId, tenantId, reason, assignedUserId);
  }

  private isCaseEligibleForInProgress(status: CaseStatus): boolean {
    const eligibleStatuses: CaseStatus[] = [
      CaseStatus.STATUS_10_ASSIGNED,
      CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      CaseStatus.STATUS_03_RETURNED,
    ];

    return eligibleStatuses.includes(status);
  }
}
