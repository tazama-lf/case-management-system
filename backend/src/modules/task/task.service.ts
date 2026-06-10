import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateTaskDto } from './dto/create-task.dto';
import { Outcome } from '../../utils/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma, CaseStatus, Case } from '@prisma/client-cms';
import { TaskAssignedEvent } from '../events/domain-events';
import { TaskRepository } from '../repository/task.repository';
import { FlowableService } from '../flowable/flowable.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { CLOSED_CASE_STATUSES } from 'src/constants/case.constants';
import { setTimeout } from 'node:timers/promises';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly logger: LoggerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async createTask(taskDTO: CreateTaskDto, userId: string, tenantId: string, tx?: Prisma.TransactionClient): Promise<Task> {
    this.logger.log('Start - createTask', TaskService.name);
    try {
      const caseRecord = await this.taskRepository.findCaseBasic(taskDTO.caseId, tenantId);
      if (!caseRecord) {
        throw new NotFoundException(`Case ${taskDTO.caseId} not found`);
      }

      const createdTask = await this.taskRepository.createTask(
        {
          case: {
            connect: {
              case_id: taskDTO.caseId,
            },
          },
          tenant_id: caseRecord.tenant_id,
          name: taskDTO.name,
          description: taskDTO.description,
          candidateGroup: taskDTO.candidateGroup,
          status: taskDTO.status,
          assigned_user_id: taskDTO.assignedUserId,
          investigationNotes: taskDTO.investigationNotes,
        },
        tx,
      );

      if (createdTask === null) {
        throw new Error('Failed to create task');
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
          entityName: TaskService.name,
          operation: 'createTask',
          outcome: Outcome.SUCCESS,
          tenantId: caseRecord.tenant_id,
        },
        createdTask.case_id,
        caseRecord.tenant_id,
        createdTask.task_id,
      );

      return createdTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating task: ${errorMessage}`, errorStack, TaskService.name);
      this.loggingOrchestrationService.logActions({
        userId,
        actionPerformed: `Error creating task with candidateGroup: ${taskDTO.candidateGroup} - ${errorMessage}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw error;
    }
  }

  async updateTask(taskId: number, updateData: Partial<UpdateTaskDto>, userId: string, tenantId: string): Promise<Task> {
    this.logger.log(`Start - Update Task: ${taskId}`, TaskService.name);
    try {
      const txResult = await this.taskRepository.transaction(async (tx) => {
        let updatedTask: Task;
        const existingTask = await this.taskRepository.findTaskWithCase(taskId, tenantId, tx);
        if (existingTask === null || existingTask.case === null) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }

        let investigationNote: string | undefined;
        if (existingTask.investigationNotes !== null && updateData.investigationNotes !== undefined) {
          investigationNote = `${existingTask.investigationNotes}\n\n[${new Date().toISOString()}] Completion Notes: ${updateData.investigationNotes ?? ''}`;
        }

        const updateInput: Prisma.TaskUpdateInput = {
          status: updateData.status,
          assigned_user_id: updateData.assignedUserId === existingTask.assigned_user_id ? existingTask.assigned_user_id : userId,
          investigationNotes: investigationNote,
        };

        const shouldPromoteCaseToInProgress = this.shouldPromoteCaseToInProgress(existingTask, updateData);
        const isCaseEligibleForInProgress = this.isCaseEligibleForInProgress(existingTask.case.status);
        if (shouldPromoteCaseToInProgress && isCaseEligibleForInProgress) {
          updatedTask = await this.promoteCaseToInProgress(taskId, updateInput, existingTask, tenantId, tx);
        } else {
          updatedTask = await this.taskRepository.updateTask(taskId, updateInput, tx);
          await this.executeFlowableOperation(updatedTask, updateData.assignedUserId ?? existingTask.assigned_user_id!);
        }

        if (existingTask.status === updatedTask.status) {
          await this.loggingOrchestrationService.logActions({
            userId,
            actionPerformed: `Updated task ${taskId}`,
            entityName: TaskService.name,
            operation: 'updateTask',
            outcome: Outcome.SUCCESS,
            tenantId: updatedTask.tenant_id,
          });
        } else {
          await this.loggingOrchestrationService.logActionsWithHistory(
            {
              userId,
              actionPerformed: `Updated task ${taskId} from ${existingTask.status} to ${updatedTask.status}`,
              entityName: TaskService.name,
              operation: 'updateTask',
              outcome: Outcome.SUCCESS,
              tenantId: updatedTask.tenant_id,
            },
            updatedTask.case_id,
            updatedTask.tenant_id,
            updatedTask.task_id,
          );
        }

        return { updatedTask };
      });

      this.logger.log('End - updateTask', TaskService.name);
      return txResult.updatedTask;
    } catch (error) {
      this.logger.error(`Error updating task ${taskId}`, error, TaskService.name);
      await this.loggingOrchestrationService.logActions({
        userId,
        actionPerformed: `Error updating task ${taskId}: ${JSON.stringify(updateData)}`,
        entityName: TaskService.name,
        operation: 'updateTask',
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw error;
    }
  }

  async getTasksByCaseId(caseId: number, tenantId: string, userId?: string, userClaims: string[] = []): Promise<Task[]> {
    this.logger.log('Retrieving tasks by case', TaskService.name);

    try {
      const tasks = await this.taskRepository.findTasks({ case_id: caseId }, tenantId, true);
      const enrichedTasks = tasks.map((task) => {
        const assignedUser: string | null = task.assigned_user_id;
        return {
          ...task,
          assignedUser,
        };
      });

      if (userId) {
        await this.loggingOrchestrationService.logActions({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Successfully retrieved tasks for case: ${caseId}`,
          outcome: Outcome.SUCCESS,
          tenantId,
        });
      }

      return enrichedTasks;
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      if (userId) {
        await this.loggingOrchestrationService.logActions({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Error retrieving tasks for case: ${caseId}`,
          outcome: Outcome.FAILURE,
          tenantId,
        });
      }
      throw error;
    }
  }

  async getTasks(tenantId: string, status?: string): Promise<Task[]> {
    try {
      const where = status ? { status: status as TaskStatus } : {};
      return await this.taskRepository.findTasks(where, tenantId, true);
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      throw error;
    }
  }

  async getTaskById(taskId: number, tenantId: string): Promise<Task | null> {
    try {
      return await this.taskRepository.findTaskWithCase(taskId, tenantId);
    } catch (error) {
      this.logger.error(`Error retrieving task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async claimTask(taskId: number, userId: string, tenantId: string): Promise<Task> {
    this.logger.log(`User ${userId} claiming task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
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
        new TaskAssignedEvent(taskId, updatedTask.case_id, userId, previousAssignedUserId ?? undefined),
      );

      this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          actionPerformed: `Claimed task ${taskId}`,
          entityName: TaskService.name,
          operation: 'claimTask',
          outcome: Outcome.SUCCESS,
          tenantId: updatedTask.tenant_id,
        },
        updatedTask.case_id,
        updatedTask.tenant_id,
        taskId,
      );

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error claiming task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async getUserTasks(userId: string, tenantId: string, includeCompleted = false): Promise<Task[]> {
    try {
      const statusFilter = includeCompleted
        ? {}
        : {
            status: {
              not: TaskStatus.STATUS_30_COMPLETED,
            },
          };

      return await this.taskRepository.findTasks({ assigned_user_id: userId, ...statusFilter }, tenantId, true);
    } catch (error) {
      this.logger.error(`Error retrieving tasks for user ${userId}`, error, TaskService.name);
      throw error;
    }
  }

  private shouldPromoteCaseToInProgress(task: Task, updateData: Partial<UpdateTaskDto>): boolean {
    const isStatusChangeToInProgress =
      updateData.status === TaskStatus.STATUS_20_IN_PROGRESS && task.status !== TaskStatus.STATUS_20_IN_PROGRESS;
    const isInvestigationTask = task.name === 'Investigate Case';
    return isStatusChangeToInProgress && isInvestigationTask;
  }

  private async promoteCaseToInProgress(
    taskId: number,
    updateInput: Prisma.TaskUpdateInput,
    existingTask: Task,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Task> {
    try {
      const taskRecord = await this.taskRepository.updateTask(taskId, updateInput, tx);
      const caseRecord = await this.taskRepository.findCaseStatus(taskRecord.case_id, tenantId, tx);

      const assigneeId = taskRecord.assigned_user_id ?? existingTask.assigned_user_id ?? null;
      const caseUpdateData: Prisma.CaseUpdateInput = { status: CaseStatus.STATUS_20_IN_PROGRESS };
      if (assigneeId && caseRecord!.case_owner_user_id !== assigneeId) caseUpdateData.case_owner_user_id = assigneeId;
      const updatedCase = await this.taskRepository.updateCase(taskRecord.case_id, caseUpdateData, tx);
      if (updatedCase.parent_id) {
        await this.promoteParentCaseToInProgress(updatedCase.parent_id, updatedCase, tx);
      }

      await this.executeFlowableOperation(taskRecord, taskRecord.assigned_user_id ?? existingTask.assigned_user_id!);

      return taskRecord;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error promoting case to in progress for task ${taskId}: ${errorMessage}`, errorStack, TaskService.name);
      throw error;
    }
  }

  private readonly promoteParentCaseToInProgress = async (
    parentId: number,
    updatedCase: Case,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> => {
    try {
      const subCase = await tx.case.findFirst({
        where: {
          parent_id: parentId,
          NOT: {
            case_id: updatedCase.case_id,
          },
        },
      });

      if (
        updatedCase.status === CaseStatus.STATUS_20_IN_PROGRESS &&
        subCase?.status &&
        (subCase.status === CaseStatus.STATUS_20_IN_PROGRESS ||
          subCase.status === CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL ||
          CLOSED_CASE_STATUSES.includes(subCase.status))
      ) {
        await tx.case.update({
          where: { case_id: parentId },
          data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
        });
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error promoting parent case: ${errorMessage}`, errorStack, TaskService.name);
      throw error;
    }
  };

  private isCaseEligibleForInProgress(status: CaseStatus): boolean {
    const eligibleStatuses: CaseStatus[] = [
      CaseStatus.STATUS_10_ASSIGNED,
      CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      CaseStatus.STATUS_03_RETURNED,
    ];

    return eligibleStatuses.includes(status);
  }

  async executeFlowableOperation(updatedTask: Task, assignedUserId: string): Promise<void> {
    const flowableOperation = async (): Promise<void> => {
      await this.flowableService.handleTaskAssigned({
        taskId: updatedTask.task_id,
        caseId: updatedTask.case_id,
        assignedUserId,
        taskName: updatedTask.name!,
      });
    };

    await this.retry(flowableOperation, 5);
  }

  private async retry(fn: () => Promise<void>, maxRetries: number, attempt = 1): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (attempt >= maxRetries) throw error;

      await setTimeout(1000 * attempt);
      await this.retry(fn, maxRetries, attempt + 1);
    }
  }
}
