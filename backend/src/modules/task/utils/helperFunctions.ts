import { NotFoundException } from '@nestjs/common';
import { CaseStatus, TaskType } from '@prisma/client-cms';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { IFlowableTask } from 'src/modules/task-sync/types/IFlowableTask';

export function isCaseEligibleForInProgress(status: CaseStatus): boolean {
  const eligibleStatuses: CaseStatus[] = [
    CaseStatus.STATUS_10_ASSIGNED,
    CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    CaseStatus.STATUS_03_RETURNED,
  ];

  return eligibleStatuses.includes(status);
}

// export async function fetchFlowableTasks(caseId: number, maxRetries: number, delayMs: number, loggerService: LoggerService) {
//   loggerService.log(`Start - fetchFlowableTasks`);
//   let retries = 0;
//   let lastError: Error | null = null;
//   let flowableProcessTasks: unknown[] = [];
//   while (retries < maxRetries) {
//     try {
//       flowableProcessTasks = await this.flowableService.fetchFlowableTasks(caseId);
//       if (flowableProcessTasks && flowableProcessTasks.length > 0) {
//         loggerService.log(`End Success - fetchFlowableTasks`);
//         return flowableProcessTasks;
//       }

//       loggerService.warn(`No tasks found for caseId ${caseId}. Retrying... (${retries + 1}/${maxRetries})`);

//       await this.sleep(delayMs);
//       retries++;
//     } catch (error) {
//       loggerService.warn(`Problem fetching tasks from Flowable: ${error}`);
//       lastError = error;
//     }
//   }

//   if (lastError != null) {
//     throw lastError;
//   }
//   return [];
// }

// export async function fetchFilteredFlowableTask(caseId: number, taskType: TaskType, loggerService: LoggerService) {
//   const flowableProcessTasks = await this.fetchFlowableTasks(caseId, 5, 80, loggerService);
//   const targetFlowableTask = flowableProcessTasks.find((task: IFlowableTask) => task.category === taskType) as IFlowableTask;
//   if (!targetFlowableTask) {
//     throw new NotFoundException(`No Flowable task found for caseId ${caseId} with taskType ${taskType}`);
//   }
//   return targetFlowableTask;
// }
