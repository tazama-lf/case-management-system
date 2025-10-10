import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma } from '@prisma/client';
import { FlowableService } from 'src/flowable/flowable.service';
import { ConfigService } from '@nestjs/config';
import { AuthHelperService } from '../auth/auth-helper.service';
import { NotificationService } from 'src/notification/notification.service';

// Define types for better type safety
interface TaskWithCase extends Task {
  case: {
    case_id: string;
    priority: string;
    status: string;
    created_at: Date;
  };
}

interface FlowableTask {
  id: string;
  name?: string;
  description?: string;
  assignee?: string;
  created?: string;
  dueDate?: string;
  priority?: number;
  candidateGroups?: string[];
  variables?: {
    postgres_task_id?: string;
    postgres_case_id?: string;
    task_status?: string;
    assignee_user_id?: string;
    [key: string]: any;
  };
}

@Injectable()
export class TaskService {
  private readonly systemUserId: string;

  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly flowableService: FlowableService,
    private readonly configService: ConfigService,
    private readonly authHelperService: AuthHelperService,
    private readonly notificationService: NotificationService,
  ) {
    this.systemUserId = this.configService.get<string>('SYSTEM_UUID', 'system-user');
  }


  async createTask(taskDTO: CreateTaskDto, userId: string, auditLogService: AuditLogService, loggerService: LoggerService) {
    loggerService.log('Creating task with Flowable integration', TaskService.name);

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

      let flowableTaskId: string | null = null;
      try {
        const flowableTask = await this.flowableService.createTaskWithContext({
          name: taskDTO.name,
          description: taskDTO.description,
          tenantId: result.tenantId,
          candidateGroup: taskDTO.candidateGroup || 'Investigations',
          postgresTaskId: result.task.task_id,
          postgresCaseId: taskDTO.caseId,
          status: result.task.status,
        });
        flowableTaskId = flowableTask.id;

        if (taskDTO.assignedUserId && flowableTaskId) {
          await this.flowableService.claimTask(flowableTaskId, taskDTO.assignedUserId);
        }

        loggerService.log(`Created Flowable task ${flowableTaskId} for database task ${result.task.task_id}`, TaskService.name);
      } catch (flowableError) {
        loggerService.error(`Failed to create Flowable task: ${flowableError.message}`, flowableError.stack, TaskService.name);
      }

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
        flowableTaskId,
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

      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: assignedUserId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(tenantId)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          return vars.postgres_task_id === taskId;
        });

        if (flowableTask && assignedUserId) {
          await this.flowableService.claimTask(flowableTask.id, assignedUserId);
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to update Flowable task: ${flowableError.message}`, TaskService.name);
      }

      await this.auditLogService.logAction({
        userId,
        actionPerformed: `Reassigned task ${taskId} to ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'reassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      this.logger.log(`Task ${taskId} successfully reassigned to ${assignedUserId}`, TaskService.name);
      return updatedTask;
    } catch (error) {
      this.logger.error(`Error reassigning task ${taskId}: ${error.message}`, error, TaskService.name);
      throw error;
    }
  }

  async updateTask(taskId: string, updateData: Partial<UpdateTaskDto>, userId: string, auditLogService: AuditLogService | null) {
    this.logger.log(`Updating task ${taskId}`, TaskService.name);

    try {
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

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(updatedTask.case_id)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          return vars.postgres_task_id === taskId;
        });

        if (flowableTask) {
          if (updateData.status) {
            await this.flowableService.updateTaskVariable(flowableTask.id, 'task_status', updateData.status);
          }

          if (updateData.assignedUserId !== undefined) {
            if (updateData.assignedUserId) {
              await this.flowableService.claimTask(flowableTask.id, updateData.assignedUserId);
            } else {
              await this.flowableService.unclaimTask(flowableTask.id);
            }
          }

          if (updateData.status === TaskStatus.STATUS_30_COMPLETED) {
            await this.flowableService.completeTask(flowableTask.id);
          }
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to update Flowable task: ${flowableError.message}`, TaskService.name);
      }

      this.logger.log(`Task updated: ${updatedTask.task_id}`, TaskService.name);

      // Use provided auditLogService or fallback to class instance
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
      const flowableTasks = (await this.flowableService.getCandidateGroupTasks(candidateGroup, true)) as FlowableTask[];

      const taskIds = flowableTasks.map((ft: FlowableTask) => ft.variables?.postgres_task_id).filter((id): id is string => Boolean(id));

      let dbTasks: TaskWithCase[] = [];
      if (taskIds.length > 0) {
        dbTasks = (await this.prisma.task.findMany({
          where: {
            task_id: { in: taskIds },
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
        })) as TaskWithCase[];
      }

      const mergedTasks = flowableTasks.map((ft: FlowableTask) => {
        const dbTask = dbTasks.find((dt: TaskWithCase) => dt.task_id === ft.variables?.postgres_task_id);
        return {
          flowableTaskId: ft.id,
          taskId: dbTask?.task_id,
          name: ft.name || dbTask?.name,
          description: ft.description || dbTask?.description,
          status: dbTask?.status,
          assignee: ft.assignee,
          assignedUser: (dbTask as any)?.assignedUser,
          candidateGroup: candidateGroup,
          case: dbTask?.case,
          created: ft.created,
          dueDate: ft.dueDate,
          priority: ft.priority,
          variables: ft.variables,
        };
      });

      this.auditLogService.logAction({
        userId,
        operation: 'getTasksByCandidateGroup',
        entityName: TaskService.name,
        actionPerformed: `Successfully retrieved ${mergedTasks.length} tasks for candidateGroup: ${candidateGroup}`,
        outcome: Outcome.SUCCESS,
      });

      return mergedTasks;
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
      const flowableTasks = (await this.flowableService.getCandidateGroupTasks('Investigations', true)) as FlowableTask[];

      const unassignedTasks = flowableTasks.filter((ft: FlowableTask) => !ft.assignee);

      const taskIds = unassignedTasks.map((ft: FlowableTask) => ft.variables?.postgres_task_id).filter((id): id is string => Boolean(id));

      let dbTasks: TaskWithCase[] = [];
      if (taskIds.length > 0) {
        dbTasks = (await this.prisma.task.findMany({
          where: {
            task_id: { in: taskIds },
            status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED] },
          },
          include: {
            case: true,
          },
          orderBy: { created_at: 'desc' },
        })) as any;
      }

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
      throw new BadRequestException('Assigned user ID cannot be null or undefined');
    }

    const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(assignedUserId);
    if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
      this.logger.error(`User ${assignedUserId} does not have INVESTIGATOR role`, null, TaskService.name);
      throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
    }

    try {
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: assignedUserId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(tenantId)) as FlowableTask[];
        console.log("flowable tasks: ", flowableTasks);
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          console.log("vars: ", vars);
          return vars.postgres_task_id === taskId;
        });

        console.log("FlowableTask: ", flowableTask);
        
        if (flowableTask && assignedUserId) {
          console.log("assignedUserId: ", assignedUserId);
          const response1 = await this.flowableService.claimTask(flowableTask.id, assignedUserId);
          console.log("response1: ", response1);
          const response2  = await this.flowableService.updateTaskVariable(flowableTask.id, 'assignee_user_id', assignedUserId);
          console.log("response2: ", response2);
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to update Flowable task: ${flowableError.message}`, TaskService.name);
      }

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

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error assigning task ${taskId}`, error, TaskService.name);
      throw error;
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

      let flowableTasks: FlowableTask[] = [];

      if (candidateGroup) {
        flowableTasks = (await this.flowableService.getCandidateGroupTasks(candidateGroup, true)) as FlowableTask[];
      } else if (assignedToMe) {
        flowableTasks = (await this.flowableService.getUserTasks(assignedToMe, true)) as FlowableTask[];
      } else {
        const allQueues = ['Supervisors', 'Investigations', 'Analysts'];
        for (const queue of allQueues) {
          const tasks = (await this.flowableService.getCandidateGroupTasks(queue, true)) as FlowableTask[];
          flowableTasks.push(...tasks);
        }
      }

      if (unassignedOnly) {
        flowableTasks = flowableTasks.filter((ft: FlowableTask) => !ft.assignee);
      }

      const start = (page - 1) * limit;
      const paginatedTasks = flowableTasks.slice(start, start + limit);

      // Get corresponding database tasks
      const taskIds = paginatedTasks.map((ft: FlowableTask) => ft.variables?.postgres_task_id).filter((id): id is string => Boolean(id));

      let dbTasks: TaskWithCase[] = [];
      if (taskIds.length > 0) {
        dbTasks = (await this.prisma.task.findMany({
          where: { task_id: { in: taskIds } },
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
        })) as TaskWithCase[];
      }

      const tasks = paginatedTasks.map((ft: FlowableTask) => {
        const dbTask = dbTasks.find((dt: TaskWithCase) => dt.task_id === ft.variables?.postgres_task_id);
        return {
          flowableTaskId: ft.id,
          taskId: dbTask?.task_id,
          name: ft.name || dbTask?.name,
          description: ft.description || dbTask?.description,
          status: dbTask?.status,
          assignee: ft.assignee,
          assignedUser: (dbTask as any)?.assignedUser,
          candidateGroups: ft.candidateGroups,
          case: dbTask?.case,
          created: ft.created,
          dueDate: ft.dueDate,
        };
      });

      return {
        tasks,
        total: flowableTasks.length,
        page,
        limit,
        totalPages: Math.ceil(flowableTasks.length / limit),
      };
    } catch (error) {
      this.logger.error('Error retrieving work queue', error, TaskService.name);
      throw error;
    }
  }

  async getWorkQueueStatistics(userId: string) {
    try {
      const statistics = await this.flowableService.getWorkQueueStatistics();

      const userTasks = (await this.flowableService.getUserTasks(userId, false)) as FlowableTask[];

      return {
        queues: statistics,
        userStats: {
          totalAssigned: userTasks.length,
          byStatus: userTasks.reduce((acc: any, task: FlowableTask) => {
            const status = task.variables?.task_status || 'unknown';
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
      // Update task in database
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: userId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(updatedTask.case_id)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          return vars.postgres_task_id === taskId;
        });

        if (flowableTask) {
          await this.flowableService.claimTask(flowableTask.id, userId);
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to claim Flowable task: ${flowableError.message}`, TaskService.name);
      }

      // Audit log
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
      // Retrieve the task first
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
        throw new BadRequestException(msg);
      }

      // Check if task is already completed
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

      // Check if task is already unassigned
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

      // Permission validation - map candidate groups to required roles
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

      // Store the original assignee for notification
      const originalAssignee = existingTask.assigned_user_id;

      // Update the task in the database
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: null,
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
      });


      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(tenantId)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft) => ft.variables?.postgres_task_id === taskId);

        if (flowableTask) {
          // Unclaim the task (removes assignee)
          await this.flowableService.unclaimTask(flowableTask.id);

          // Ensure the task is assigned to its candidate group
          if (candidateGroup) {
            // First, get current identity links to check if group assignment exists
            const identityLinks = await this.flowableService.getTaskIdentityLinks(flowableTask.id);
            const hasGroupLink = identityLinks.some(
                (link: any) => link.type === 'candidate' && link.group === candidateGroup
            );

            if (!hasGroupLink) {
              await this.flowableService.assignTaskToCandidateGroup(flowableTask.id, candidateGroup);
            }
          }

          this.logger.log(
              `Task ${taskId} (Flowable: ${flowableTask.id}) returned to work queue: ${candidateGroup}`,
              TaskService.name
          );
        } else {
          this.logger.warn(
              `Flowable task not found for database task ${taskId}. Database updated but Flowable sync skipped.`,
              TaskService.name
          );
        }
      } catch (flowableError) {
        this.logger.error(
            `Failed to sync with Flowable when unassigning task ${taskId}: ${flowableError.message}`,
            flowableError.stack,
            TaskService.name
        );

      }

      try {
        if (originalAssignee) {
          await this.notificationService.sendNotification({
            userId: originalAssignee,
            type: 'TASK_UNASSIGNED',
            message: `Task "${existingTask.name || taskId}" has been unassigned${reason ? `: ${reason}` : ''}`,
            metadata: {
              taskId,
              caseId: existingTask.case_id,
              unassignedBy: userId,
              reason,
            },
          });
        }

        // Notify candidate group members (if configured)
        if (candidateGroup) {
          await this.notificationService.sendGroupNotification({
            candidateGroup,
            type: 'TASK_AVAILABLE',
            message: `Task "${existingTask.name || taskId}" is now available in the ${candidateGroup} work queue`,
            metadata: {
              taskId,
              caseId: existingTask.case_id,
            },
          });
        }
      } catch (notificationError) {
        this.logger.warn(
            `Failed to send notifications for task unassignment: ${notificationError.message}`,
            TaskService.name
        );
        // Don't throw - task unassignment succeeded
      }

      // Audit logging
      await this.auditLogService.logAction({
        userId,
        actionPerformed: `Unassigned task ${taskId} from user ${originalAssignee}. Task returned to group: ${candidateGroup}${reason ? `. Reason: ${reason}` : ''}`,
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
      };
    } catch (error) {
      this.logger.error(
          `Error unassigning task ${taskId}: ${error.message}`,
          error.stack,
          TaskService.name
      );

      // If it's already a BadRequestException or ForbiddenException, rethrow as-is
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      // Otherwise, wrap in a generic error
      throw new BadRequestException(`Failed to unassign task: ${error.message}`);
    }
  }

  async releaseTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
    this.logger.log(`User ${userId} releasing task ${taskId}`, TaskService.name);

    try {
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

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(updatedTask.case_id)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          return vars.postgres_task_id === taskId;
        });

        if (flowableTask) {
          await this.flowableService.unclaimTask(flowableTask.id);
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to release Flowable task: ${flowableError.message}`, TaskService.name);
      }

      // Audit log
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
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          status: TaskStatus.STATUS_30_COMPLETED,
        },
        include: {
          case: true,
        },
      });

      try {
        const flowableTasks = (await this.flowableService.getTenantTasks(updatedTask.case_id)) as FlowableTask[];
        const flowableTask = flowableTasks.find((ft: FlowableTask) => {
          const vars = ft.variables || {};
          return vars.postgres_task_id === taskId;
        });

        if (flowableTask) {
          await this.flowableService.completeTask(flowableTask.id);
        }
      } catch (flowableError) {
        this.logger.warn(`Failed to complete Flowable task: ${flowableError.message}`, TaskService.name);
      }

      // Audit log
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
