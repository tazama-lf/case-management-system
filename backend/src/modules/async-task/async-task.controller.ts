import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { AsyncTaskService } from './async-task.service';

@Controller('async-tasks')
export class AsyncTaskController {
  private readonly logger = new Logger(AsyncTaskController.name);

  constructor(private readonly asyncTaskService: AsyncTaskService) {}

  /**
   * Get task by ID
   */
  @Get(':taskId')
  async getTask(@Param('taskId') taskId: string) {
    return this.asyncTaskService.getTaskById(taskId);
  }

  /**
   * Get failed tasks
   */
  @Get('failed/list')
  async getFailedTasks() {
    return this.asyncTaskService.getFailedTasks(50);
  }

  /**
   * Retry a failed task
   */
  @Post(':taskId/retry')
  async retryTask(@Param('taskId') taskId: string) {
    await this.asyncTaskService.retryFailedTask(taskId);
    return {
      success: true,
      message: `Task ${taskId} scheduled for retry`,
    };
  }
}
