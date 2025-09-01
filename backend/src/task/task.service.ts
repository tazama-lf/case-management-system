import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTask(taskDTO: CreateTaskDto, userId: string) {
    this.logger.log('Creating task', TaskService.name);

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

      this.logger.log(`Task created: ${task.task_id}`, TaskService.name);
      this.auditLogService.logAction({
        userId,
        actionPerformed: `Created task ${task.task_id}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return task;
    } catch (error) {
      this.logger.error('Error creating task', error, TaskService.name);
      this.auditLogService.logAction({
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

  async reassignTask(taskId: string, userId: string, assignedUserId: string) {
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

  async updateTask(taskId: string, updateData: Partial<UpdateTaskDto>, userId: string) {
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
}
