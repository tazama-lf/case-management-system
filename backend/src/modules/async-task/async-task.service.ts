import { Injectable, Logger } from '@nestjs/common';
import { AsyncTaskRepository } from '../repository/async-task.repository';

@Injectable()
export class AsyncTaskService {
  private readonly logger = new Logger(AsyncTaskService.name);

  constructor(private readonly asyncTaskRepository: AsyncTaskRepository) {}

  async createEmailTask(to: string, subject: string, html: string, metadata?: Record<string, any>): Promise<string> {
    const task = await this.asyncTaskRepository.createEmailTask(to, subject, html, metadata);

    this.logger.log(`Email task created: ${task} for ${to} - Subject: ${subject}`);
    return task.id;
  }

  async getTaskById(taskId: number) {
    return await this.asyncTaskRepository.getTaskById(taskId);
  }

  async getFailedTasks(limit = 100) {
    return await this.asyncTaskRepository.getFailedTasks(limit);
  }

  async retryFailedTask(taskId: number): Promise<void> {
    await this.asyncTaskRepository.retryFailedTask(taskId);
    this.logger.log(`Task ${taskId} reset for retry`);
  }

  async markAsProcessing(taskId: number): Promise<void> {
    await this.asyncTaskRepository.markAsProcessing(taskId);
  }

  async markAsCompleted(taskId: number): Promise<void> {
    await this.asyncTaskRepository.markAsCompleted(taskId);
  }

  async markAsFailed(taskId: number, retryCount: number): Promise<void> {
    await this.asyncTaskRepository.markAsFailed(taskId, retryCount);
  }

  async scheduleRetry(taskId: number, retryCount: number, nextRetryAt: Date): Promise<void> {
    await this.asyncTaskRepository.scheduleRetry(taskId, retryCount, nextRetryAt);
  }

  async getPendingTasksForProcessing(limit = 10) {
    return await this.asyncTaskRepository.getPendingTasksForProcessing(limit);
  }
}
