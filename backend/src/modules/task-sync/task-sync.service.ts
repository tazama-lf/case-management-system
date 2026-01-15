import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskService } from '../task/task.service';
import { FlowableService } from '../flowable/flowable.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateTaskDto } from '../../dtos/create-task.dto';
import { Prisma, Task, TaskStatus } from '@prisma/client-cms';

@Injectable()
export class TaskSyncService {
  constructor(
    private readonly taskService: TaskService,
    private readonly flowableService: FlowableService,
    private readonly loggerService: LoggerService,
  ) {}

  async syncTaskCreationWithFlowable(
    userId: string,
    caseId: number,
    candidateGroup: string,
    syncOptions: { maxRetries: number; delayMs: number },
    tx?: Prisma.TransactionClient,
  ): Promise<Task[]> {
    this.loggerService.log(`Start - syncTaskCreationWithFlowable`, TaskSyncService.name);
    try {
      const flowableProcessTasks = await this.fetchFlowableTasks(caseId, syncOptions.maxRetries, syncOptions.delayMs);
      if (flowableProcessTasks.length === 0) {
        this.loggerService.warn(`No tasks retrieved from Flowable for caseId ${caseId}`, TaskSyncService.name);
        return [];
      }
      const createdTasks = await Promise.all(
        flowableProcessTasks.map(async (task: { name: string; description: string }) => {
          const createTaskDto: CreateTaskDto = {
            caseId: caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: task.name,
            description: task.description,
            candidateGroup: candidateGroup,
          };
          try {
            return await this.taskService.createTask(createTaskDto, userId, tx);
          } catch (error) {
            throw error;
          }
        }),
      );
      return createdTasks;
    } catch (error) {
      this.loggerService.error(`Error in syncTaskCreationWithFlowable: ${error}`, TaskSyncService.name);
      throw error;
    }
  }

  async syncTaskUpdateWithFlowable() {}

  private async fetchFlowableTasks(caseId: number, maxRetries: number, delayMs: number) {
    let retries = 0;
    let lastError: Error | null = null;
    let flowableProcessTasks: unknown[] = [];
    while (retries < maxRetries) {
      try {
        flowableProcessTasks = await this.flowableService.fetchFlowableTasks(caseId);
        if (flowableProcessTasks && flowableProcessTasks.length > 0) {
          return flowableProcessTasks;
        }

        this.loggerService.warn(`No tasks found for caseId ${caseId}. Retrying... (${retries + 1}/${maxRetries})`, TaskSyncService.name);

        await this.sleep(delayMs);
        retries++;
      } catch (error) {
        this.loggerService.warn(`Problem fetching tasks from Flowable: ${error}`, TaskSyncService.name);
        lastError = error;
      }
    }

    if (lastError != null) {
      throw lastError;
    }
    return [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
