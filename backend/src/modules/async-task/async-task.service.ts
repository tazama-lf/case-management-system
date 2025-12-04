import { Injectable, Logger } from '@nestjs/common';
import { AsyncTaskRepository } from '../repository/async-task.repository';

@Injectable()
export class AsyncTaskService {
    private readonly logger = new Logger(AsyncTaskService.name);

    constructor(private readonly asyncTaskRepository: AsyncTaskRepository) { }

    async createEmailTask(
        to: string,
        subject: string,
        html: string,
        metadata?: Record<string, any>,
    ): Promise<string> {
        const task = await this.asyncTaskRepository.createEmailTask(
            to,
            subject,
            html,
            metadata,
        );

        this.logger.log(`Email task created: ${task} for ${to} - Subject: ${subject}`);
        return task.id;
    }

    async getTaskById(taskId: string) {
        return this.asyncTaskRepository.getTaskById(taskId);
    }

    async getFailedTasks(limit = 100) {
        return this.asyncTaskRepository.getFailedTasks(limit);
    }

    async retryFailedTask(taskId: string): Promise<void> {
        await this.asyncTaskRepository.retryFailedTask(taskId);
        this.logger.log(`Task ${taskId} reset for retry`);
    }

    async markAsProcessing(taskId: string): Promise<void> {
        await this.asyncTaskRepository.markAsProcessing(taskId);
    }

    async markAsCompleted(taskId: string): Promise<void> {
        await this.asyncTaskRepository.markAsCompleted(taskId);
    }

    async markAsFailed(taskId: string, retryCount: number): Promise<void> {
        await this.asyncTaskRepository.markAsFailed(taskId, retryCount);
    }

    async scheduleRetry(taskId: string, retryCount: number, nextRetryAt: Date): Promise<void> {
        await this.asyncTaskRepository.scheduleRetry(taskId, retryCount, nextRetryAt);
    }

    async getPendingTasksForProcessing(limit: number = 10) {
        return this.asyncTaskRepository.getPendingTasksForProcessing(limit);
    }
}
