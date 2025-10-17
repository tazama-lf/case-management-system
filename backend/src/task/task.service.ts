import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthHelperService } from '../auth/auth-helper.service';
import { NotificationService } from 'src/notification/notification.service';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
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
  ) {
    this.systemUserId = this.configService.get<string>('SYSTEM_UUID', 'system-user');
  }

  async createTask(taskDTO: CreateTaskDto, userId: string, auditLogService: AuditLogService, loggerService: LoggerService) {
    loggerService.log('Creating task', TaskService.name);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
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

        const caseData = await tx.case.findUnique({
          where: { case_id: taskDTO.caseId },
          select: { tenant_id: true },
        });

        if (!caseData) {
          throw new NotFoundException(`Case ${taskDTO.caseId} not found`);
        }

        return { task, tenantId: caseData.tenant_id };
      });

      this.eventEmitter.emit(
          'task.created',
          new TaskCreatedEvent(
              result.task.task_id,
              taskDTO.caseId,
              taskDTO.name,
              taskDTO.description || '',
              taskDTO.candidateGroup || 'Investigations',
              result.task.status,
              taskDTO.assignedUserId,
          ),
      );

      auditLogService.logAction({
        userId,
        actionPerformed: `Created task ${result.task.task_id}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return {
        ...result.task,
        candidateGroup: taskDTO.candidateGroup,
      };
    } catch (error) {
      loggerService.error('Error creating task', error, TaskService.name);
      auditLogService.logAction({
        userId,
        actionPerformed: `Error creating task`,
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
          new TaskAssignedEvent(
              taskId,
              updatedTask.case_id,
              assignedUserId,
              previousAssignedUserId || undefined,
          ),
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
        this.logger.warn(
            `Failed to send reassignment notifications: ${notificationError.message}`,
            TaskService.name
        );
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
          TaskService.name
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

      if (updateData.assignedUserId !== undefined &&
          updateData.assignedUserId !== existingTask.assigned_user_id) {
        if (updateData.assignedUserId) {
          this.eventEmitter.emit(
              'task.assigned',
              new TaskAssignedEvent(
                  taskId,
                  updatedTask.case_id,
                  updateData.assignedUserId,
                  existingTask.assigned_user_id || undefined,
              ),
          );
        } else {
          this.eventEmitter.emit(
              'task.unassigned',
              new TaskUnassignedEvent(
                  taskId,
                  updatedTask.case_id,
                  existingTask.assigned_user_id || undefined,
              ),
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
    this.logger.log(`Assigning task ${taskId} to investigator ${assignedUserId}`, TaskService.name);

    if (!assignedUserId) {
      this.logger.error('Assigned user ID is null or undefined', null, TaskService.name);
      throw new BadRequestException('Assigned user ID cannot be null or undefined');
    }

    this.logger.log(`Looking up user ${assignedUserId} in auth service`, TaskService.name);

    try {
      const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(assignedUserId);
      this.logger.log(`Found roles for user ${assignedUserId}: ${investigatorRoles.join(', ')}`, TaskService.name);

      if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
        this.logger.error(`User ${assignedUserId} does not have INVESTIGATOR role. Current roles: ${investigatorRoles.join(', ')}`, null, TaskService.name);
        throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
      }

      this.logger.log(`User ${assignedUserId} has CMS_INVESTIGATOR role`, TaskService.name);
    } catch (error) {
      this.logger.error(`Failed to get roles for user ${assignedUserId}: ${error.message}`, error.stack, TaskService.name);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`User ${assignedUserId} not found`);
    }

    try {
      this.logger.log(`Fetching task ${taskId} details`, TaskService.name);

      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        this.logger.error(`Task ${taskId} not found`, null, TaskService.name);
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      this.logger.log(`Task ${taskId} found. Current status: ${existingTask.status}, Current assignee: ${existingTask.assigned_user_id || 'None'}`, TaskService.name);

      const previousAssignedUserId = existingTask.assigned_user_id;

      this.logger.log(`Updating task ${taskId} in database`, TaskService.name);

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: assignedUserId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      this.logger.log(`Task ${taskId} successfully updated. New status: ${updatedTask.status}, New assignee: ${updatedTask.assigned_user_id}`, TaskService.name);

      this.logger.log(`Emitting task.assigned event for task ${taskId}`, TaskService.name);

      this.eventEmitter.emit(
          'task.assigned',
          new TaskAssignedEvent(
              taskId,
              updatedTask.case_id,
              assignedUserId,
              previousAssignedUserId || undefined,
          ),
      );

      this.logger.log(`Logging audit actions for task ${taskId} assignment`, TaskService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        actionPerformed: `Assigned task ${taskId} to investigator ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      await this.auditLogService.logAction({
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} retrieved by investigator ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(`Task ${taskId} successfully assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`, TaskService.name);

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error assigning task ${taskId}: ${error.message}`, error.stack, TaskService.name);

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
          new TaskAssignedEvent(
              taskId,
              updatedTask.case_id,
              userId,
              previousAssignedUserId || undefined,
          ),
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
          new TaskUnassignedEvent(
              taskId,
              updatedTask.case_id,
              originalAssignee || undefined,
              candidateGroup,
              reason,
          ),
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
        this.logger.warn(
            `Failed to send notifications for task unassignment: ${notificationError.message}`,
            TaskService.name
        );

      }

      await this.auditLogService.logAction({
        userId,
        actionPerformed: `Unassigned task ${taskId} from user ${originalAssignee}. Task returned to group: ${candidateGroup}. Reason: ${reason}`,
        entityName: TaskService.name,
        operation: 'unassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(
          `Task ${taskId} successfully unassigned and returned to ${candidateGroup} work queue`,
          TaskService.name
      );

      return {
        ...updatedTask,
        message: `Task successfully unassigned and returned to ${candidateGroup} work queue`,
        candidateGroup,
        unassignmentReason: reason,
      };
    } catch (error) {
      this.logger.error(
          `Error unassigning task ${taskId}: ${error.message}`,
          error.stack,
          TaskService.name
      );

      if (error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException) {
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
          new TaskUnassignedEvent(
              taskId,
              updatedTask.case_id,
              previousAssignedUserId || undefined,
              existingTask.candidateGroup || undefined,
          ),
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
}