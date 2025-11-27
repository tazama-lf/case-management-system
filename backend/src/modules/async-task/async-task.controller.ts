import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { AsyncTaskService } from './async-task.service';

@Controller('async-tasks')
export class AsyncTaskController {
  private readonly logger = new Logger(AsyncTaskController.name);

  constructor(private readonly asyncTaskService: AsyncTaskService) {}

  /**
   * Test endpoint to manually create an email task
   */
  @Post('test-email')
  async testEmail(
    @Body()
    body: {
      to?: string;
      subject?: string;
      html?: string;
    },
  ) {
    const to = body.to || 'test@example.com';
    const subject = body.subject || 'Test Email from Async Task Queue';
    const html = body.html || '<h1>Test Email</h1><p>This is a test email from the async task queue system.</p>';

    const taskId = await this.asyncTaskService.createEmailTask(to, subject, html, {
      test: true,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Test email task created: ${taskId}`);

    return {
      success: true,
      message: 'Email task created successfully',
      taskId,
      to,
      subject,
    };
  }

  /**
   * Get task statistics
   */
  @Get('stats')
  async getStats() {
    return this.asyncTaskService.getStats();
  }

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
