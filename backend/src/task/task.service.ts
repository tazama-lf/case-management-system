import { Injectable, BadRequestException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '@prisma/client';
import axios from 'axios';
import { FlowableService } from 'src/flowable/flowable.service';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly flowableService: FlowableService,
  ) {}

  async createTask(
    taskDTO: CreateTaskDto,
    userId: string,
    auditLogService: AuditLogService,
    loggerService: LoggerService, // Use the real type here!
  ) {
    loggerService.log('Creating task', TaskService.name);

    try {
      const task = await this.prisma.task.create({
        data: {
          case_id: taskDTO.caseId,
          status: taskDTO.status,
          assigned_user_id: taskDTO.assignedUserId,
          name: taskDTO.name,
          description: taskDTO.description,
        },
      });

      loggerService.log(`Task created: ${task.task_id}`, TaskService.name);
      auditLogService.logAction({
        userId,
        actionPerformed: `Created task ${task.task_id}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return task;
    } catch (error) {
      loggerService.error('Error creating task', error, TaskService.name);
      auditLogService.logAction({
        userId,
        actionPerformed: `Error creating task: ${JSON.stringify(taskDTO)}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
      throw error;
    }
  }

  async reassignTask(taskId: string, userId: string, assignedUserId: string, auditLogService: AuditLogService) {
    this.logger.log(`Reassigning task ${taskId} to user ${assignedUserId}`, TaskService.name);

    try {
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId },
      });

      this.logger.log(`Task reassigned: ${updatedTask.task_id}`, TaskService.name);
      this.auditLogService.logAction({
        userId,
        actionPerformed: `Reassigned task ${taskId} to user ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'reassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error reassigning task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async updateTask(taskId: string, updateData: Partial<UpdateTaskDto>, userId: string, auditLogService: AuditLogService) {
    this.logger.log(`Updating task ${taskId}`, TaskService.name);

    try {
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          status: updateData.status,
          assigned_user_id: updateData.assignedUserId,
          name: updateData.name,
          description: updateData.description,
        },
      });

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
    this.logger.log(`Retrieving tasks for candidateGroup : ${candidateGroup}`, TaskService.name);
    try {
      const tasks = await this.flowableService.getCandidateGroupTasks(candidateGroup);
      this.auditLogService.logAction({
        userId,
        operation: 'getTasksByCandidateGroup',
        entityName: TaskService.name,
        actionPerformed: `Successfully retrieved tasks for candidateGroup : ${candidateGroup}`,
        outcome: Outcome.SUCCESS,
      });

      return tasks;
    } catch (error) {
      this.logger.error(`Error retrieving tasks for candidateGroup : ${candidateGroup}`, error, TaskService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'getTasksByCandidateGroup',
        entityName: TaskService.name,
        actionPerformed: `Error retrieving tasks for candidateGroup : ${candidateGroup}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  /**
   * Get all tasks in the 'Investigations' candidate group (work queue for supervisor/investigator)
   */
  async getInvestigationQueue() {
    try {
      return await this.prisma.task.findMany({
        where: { status: TaskStatus.STATUS_10_ASSIGNED },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error retrieving investigation queue', error, TaskService.name);
      throw error;
    }
  }

  async getTasksByCaseId(caseId: string, userId?: string) {
    this.logger.log('Retrieving tasks by case', TaskService.name);
    try {
      const where = { case_id: caseId };

      const tasks = await this.prisma.task.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
      });

      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Successfully retrieved tasks for case : ${caseId}`,
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
          actionPerformed: `Error retrieving tasks for case : ${caseId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }

  async assignTaskToInvestigator(taskId: string, assignedUserId: string, supervisorId: string, auditLogService: AuditLogService) {
    this.logger.log(`Assigning task ${taskId} to investigator ${assignedUserId}`, TaskService.name);

    // 1. Validate investigator role using auth-service REST API
    const investigatorRoles = await this.getUserRolesFromAuthService(assignedUserId);
    if (!investigatorRoles.includes('INVESTIGATOR')) {
      this.logger.error(`User ${assignedUserId} does not have INVESTIGATOR role`, null, TaskService.name);
      throw new Error('Assigned user does not have INVESTIGATOR role');
    }

    try {
      // 2. Update task assignment and status
      const updatedTask = await this.prisma.task.update({
        where: { task_id: taskId },
        data: {
          assigned_user_id: assignedUserId,
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      });

      // 3. Audit log: assignment
      await this.auditLogService.logAction({
        userId: supervisorId,
        actionPerformed: `Assigned task ${taskId} to investigator ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      // 4. Audit log: retrieval
      await this.auditLogService.logAction({
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} retrieved by investigator ${assignedUserId}`,
        entityName: TaskService.name,
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      // 5. Placeholder for notification logic
      // TODO: Implement notification logic here

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error assigning task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  // Get all tasks (optionally filtered by status)
  async getTasks(status?: string) {
    try {
      const where = status ? { status: status as TaskStatus } : {};
      return await this.prisma.task.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      throw error;
    }
  }

  // Get single task by ID
  async getTaskById(taskId: string) {
    try {
      return await this.prisma.task.findUnique({
        where: { task_id: taskId },
      });
    } catch (error) {
      this.logger.error(`Error retrieving task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  // Helper function: fetch user roles from auth-service REST API
  private async getUserRolesFromAuthService(userId: string): Promise<string[]> {
    // Adjust endpoint and headers as needed for your auth-service
    const authUrl = process.env.TAZAMA_AUTH_URL || 'http://localhost:3020/v1/auth';
    const endpoint = `${authUrl}/users/${userId}/roles`;

    try {
      const response = await axios.get(endpoint);
      // Adjust parsing if your API returns roles differently
      return response.data.roles || response.data; // e.g., ['INVESTIGATOR', 'ADMIN']
    } catch (error) {
      this.logger.error('Error fetching user roles', error, TaskService.name);
      throw error;
    }
  }

  /**
   * Mock: Assign an investigation task to a test investigator for workflow validation
   */
  async assignMockInvestigationTask(caseId: string) {
    await this.createTask(
      {
        caseId,
        status: 'STATUS_10_ASSIGNED',
        assignedUserId: 'test-investigator-id',
        name: 'Investigate Case',
        description: 'Please investigate this case.',
        candidateGroup: 'Investigations',
      },
      'test-supervisor-id',
      this.auditLogService,
      this.logger,
    );
    // Mock notification
    this.logger.log(`Notification: User test-investigator-id assigned to task for case ${caseId}`, TaskService.name);
  }

  /**
   * Get work queue with filtering options
   */
  async getWorkQueue(filters: { role?: string; candidateGroup?: string; page?: number; limit?: number }) {
    try {
      const { candidateGroup, page = 1, limit = 20 } = filters;

      const skip = (page - 1) * limit;

      const where: Record<string, any> = {};

      // Filter by candidate group if specified
      if (candidateGroup) {
        where.candidateGroup = candidateGroup;
      }

      // Default to showing assigned tasks (work queue items)
      where.status = {
        in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED],
      };

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
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
          skip,
          take: limit,
        }),
        this.prisma.task.count({ where }),
      ]);

      return {
        tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error retrieving work queue', error, TaskService.name);
      throw error;
    }
  }
}
