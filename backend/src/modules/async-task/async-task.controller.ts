import { Controller, Post, Get, Param } from '@nestjs/common';
import { AsyncTaskService } from './async-task.service';
import { AsyncTask } from '@prisma/client-cms';

@Controller('async-tasks')
export class AsyncTaskController {
  constructor(private readonly asyncTaskService: AsyncTaskService) {}

  /**
   * Get task by ID
   */
  @Get(':taskId')
  async getTask(@Param('taskId') taskId: number): Promise<AsyncTask | null> {
    return await this.asyncTaskService.getTaskById(taskId);
  }

  /**
   * Get failed tasks
   */
  @Get('failed/list')
  async getFailedTasks(): Promise<AsyncTask[]> {
    return await this.asyncTaskService.getFailedTasks(50);
  }

  /**
   * Retry a failed task
   */
  @Post(':taskId/retry')
  async retryTask(@Param('taskId') taskId: number): Promise<{ success: boolean; message: string }> {
    await this.asyncTaskService.retryFailedTask(taskId);
    return {
      success: true,
      message: `Task ${taskId} scheduled for retry`,
    };
  }
}
