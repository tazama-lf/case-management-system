import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AsyncTaskService, type EmailPayload } from './async-task.service';

@Injectable()
export class EmailWorkerService {
    private readonly logger = new Logger(EmailWorkerService.name);
    private readonly fromEmail: string;
    private readonly transporter: nodemailer.Transporter;
    private isProcessing = false;

    constructor(
        private readonly asyncTaskService: AsyncTaskService,
        private readonly config: ConfigService,
    ) {
        this.fromEmail = this.config.get<string>('MAIL_FROM') || '"CMS Notifications" <no-reply@cms.local>';

        const smtpHost = this.config.get<string>('SMTP_HOST');
        const smtpPort = this.config.get<string>('SMTP_PORT', '587');
        const smtpUser = this.config.get<string>('SMTP_USER');

        if (!smtpHost) {
            this.logger.warn('SMTP_HOST not configured - emails will fail to send!');
            this.logger.warn('Please configure SMTP settings in .env file');
        }

        this.transporter = nodemailer.createTransport({
            host: smtpHost || 'localhost',
            port: parseInt(smtpPort),
            secure: false,
            auth: smtpUser ? {
                user: smtpUser,
                pass: this.config.get<string>('SMTP_PASS'),
            } : undefined,
        });


        this.logger.log(`Email Worker Service initialized - SMTP: ${smtpHost || 'NOT CONFIGURED'}:${smtpPort}`);
    }

    /**
     * Process email queue every 5 seconds
     */
    @Cron(CronExpression.EVERY_5_SECONDS)
    async processEmailQueue(): Promise<void> {
        if (this.isProcessing) {
            return; // Skip if already processing
        }

        this.isProcessing = true;

        try {
            const tasks = await this.asyncTaskService.getPendingTasksForProcessing(10);

            if (tasks.length > 0) {
                this.logger.log(`Processing ${tasks.length} email tasks`);

                for (const task of tasks) {
                    await this.processTask(task);
                }
            }
        } catch (error) {
            this.logger.error(`Email queue processing error: ${error.message}`, error.stack);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process a single email task
     */
    private async processTask(task: any): Promise<void> {
        try {
            // Mark as processing
            await this.asyncTaskService.markAsProcessing(task.task_id);

            // Extract email payload
            const payload = task.payload as EmailPayload;
            const { to, subject, html } = payload;

            this.logger.debug(`Attempting to send email: ${task.task_id} to ${to}`);

            // Send email
            const info = await this.transporter.sendMail({
                from: this.fromEmail,
                to,
                subject,
                html,
            });

            this.logger.debug(`SMTP response: ${JSON.stringify(info)}`);

            // Mark as completed
            await this.asyncTaskService.markAsCompleted(task.task_id);

            this.logger.log(`Email sent successfully: ${task.task_id} to ${to} - ${subject}`);
        } catch (error) {
            this.logger.error(`Email send failed for ${task.task_id}: ${error.message}`, error.stack);
            await this.handleTaskFailure(task, error);
        }
    }

    /**
     * Handle task failure with retry logic
     */
    private async handleTaskFailure(task: any, error: Error): Promise<void> {
        const newRetryCount = task.retry_count + 1;
        const errorMessage = error.message || 'Unknown error';

        if (newRetryCount >= task.max_retries) {
            // Max retries exceeded, mark as failed
            await this.asyncTaskService.markAsFailed(task.task_id, newRetryCount);

            this.logger.error(
                `Email task failed permanently: ${task.task_id} after ${newRetryCount} attempts - ${errorMessage}`,
            );
        } else {
            // Schedule retry with exponential backoff
            const nextRetry = this.calculateNextRetry(newRetryCount);

            await this.asyncTaskService.scheduleRetry(task.task_id, newRetryCount, nextRetry);

            this.logger.warn(
                `Email task retry scheduled: ${task.task_id} (attempt ${newRetryCount}/${task.max_retries}) at ${nextRetry.toISOString()} - Error: ${errorMessage}`,
            );
        }
    }

    /**
     * Calculate next retry time with exponential backoff
     * Intervals: 1min, 5min, 15min, 1hr, 4hr (matching old NotificationRetryService)
     */
    private calculateNextRetry(retryCount: number): Date {
        // 1st retry: 1 minute
        // 2nd retry: 5 minutes
        // 3rd retry: 15 minutes
        // 4th retry: 1 hour
        // 5th retry: 4 hours
        const intervals = [60, 300, 900, 3600, 14400]; // seconds: 1min, 5min, 15min, 1hr, 4hr
        const delaySeconds = intervals[Math.min(retryCount - 1, intervals.length - 1)];
        const nextRetry = new Date();
        nextRetry.setSeconds(nextRetry.getSeconds() + delaySeconds);
        return nextRetry;
    }

    /**
     * Get worker statistics
     */
    async getWorkerStats() {
        return {
            isProcessing: this.isProcessing,
            cronSchedule: 'Every 5 seconds',
        };
    }
}
