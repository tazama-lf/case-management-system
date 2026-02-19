import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AsyncTaskStatus } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class AsyncTaskRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Create a new email task in the queue
   */
  async createEmailTask(to: string, subject: string, html: string, metadata?: Record<string, any>): Promise<Record<string, any>> {
    const task = await this.prisma.asyncTask.create({
      data: {
        task_type: 'EMAIL',
        status: AsyncTaskStatus.PENDING,
        payload: {
          to,
          subject,
          html,
          metadata,
        },
        max_retries: 5,
        retry_count: 0,
        next_retry_at: new Date(), // Send immediately
        created_by: metadata?.userId || 'SYSTEM',
      },
    });

    return task;
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: number) {
    return await this.prisma.asyncTask.findUnique({
      where: { task_id: taskId },
    });
  }

  /**
   * Get all failed tasks
   */
  async getFailedTasks(limit = 100) {
    return await this.prisma.asyncTask.findMany({
      where: { status: AsyncTaskStatus.FAILED },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Retry a failed task
   */
  async retryFailedTask(taskId: number): Promise<void> {
    await this.prisma.asyncTask.update({
      where: { task_id: taskId },
      data: {
        status: AsyncTaskStatus.PENDING,
        retry_count: 0,
        next_retry_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark task as processing
   */
  async markAsProcessing(taskId: number): Promise<void> {
    await this.prisma.asyncTask.update({
      where: { task_id: taskId },
      data: {
        status: AsyncTaskStatus.PROCESSING,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark task as completed
   */
  async markAsCompleted(taskId: number): Promise<void> {
    await this.prisma.asyncTask.update({
      where: { task_id: taskId },
      data: {
        status: AsyncTaskStatus.COMPLETED,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark task as failed
   */
  async markAsFailed(taskId: number, retryCount: number): Promise<void> {
    await this.prisma.asyncTask.update({
      where: { task_id: taskId },
      data: {
        status: AsyncTaskStatus.FAILED,
        retry_count: retryCount,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Schedule retry for a task
   */
  async scheduleRetry(taskId: number, retryCount: number, nextRetryAt: Date): Promise<void> {
    await this.prisma.asyncTask.update({
      where: { task_id: taskId },
      data: {
        status: AsyncTaskStatus.PENDING,
        retry_count: retryCount,
        next_retry_at: nextRetryAt,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get pending tasks ready for processing
   */
  async getPendingTasksForProcessing(limit = 10) {
    // Using raw query with FOR UPDATE SKIP LOCKED for safe concurrent processing
    return await this.prisma.$queryRaw<any[]>`
            SELECT * FROM async_tasks
            WHERE status = 'PENDING'
            AND task_type = 'EMAIL'
            AND next_retry_at <= NOW()
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
        `;
  }
}
