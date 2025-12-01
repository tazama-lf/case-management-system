import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../shared/user.service';
import { AsyncTaskService } from '../async-task/async-task.service';
import { EMAIL_TEMPLATES } from './utils/notification.constants';
import {
    NotificationPayload,
    GroupNotificationPayload,
    NotificationType,
    EmailTemplate,
    OverdueTaskPayload,
    SlaBreachPayload,
    SlaEventPayload,
    SlaWarningPayload,
    TaskEventPayload,
    TaskReassignedPayload
} from './utils/notification.interface';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    // Template mapping configuration
    private readonly templateMap: Record<NotificationType, (data: Record<string, any>) => EmailTemplate> = {
        TASK_ASSIGNED: (d) => ({
            subject: `New Task Assigned: ${d.taskTitle}`,
            html: EMAIL_TEMPLATES.taskAssigned(d),
        }),
        TASK_UNASSIGNED: (d) => ({
            subject: `Task Unassigned: ${d.taskTitle}`,
            html: EMAIL_TEMPLATES.taskUnassigned(d),
        }),
        TASK_REASSIGNED: (d) => ({
            subject: `Task Reassigned: ${d.taskTitle}`,
            html: EMAIL_TEMPLATES.taskReassigned(d),
        }),
        WORK_QUEUE: (d) => ({
            subject: `New Task in ${d.candidateGroup} Queue`,
            html: EMAIL_TEMPLATES.workQueue(d),
        }),
        TASK_AVAILABLE: (d) => ({
            subject: 'Task Available in Queue',
            html: EMAIL_TEMPLATES.workQueue(d),
        }),
        CASE_SUSPENDED: (d) => ({
            subject: `Case Suspended: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseSuspended(d),
        }),
        CASE_RESUMED: (d) => ({
            subject: `Case Resumed: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseResumed(d),
        }),
        CASE_CLOSURE_PENDING: (d) => ({
            subject: `Case Closure Pending Approval: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseClosurePending(d),
        }),
        CASE_CLOSURE_APPROVED: (d) => ({
            subject: `Case Closure Approved: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseClosureApproved(d),
        }),
        CASE_CLOSURE_REJECTED: (d) => ({
            subject: `Case Closure Rejected: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseClosureRejected(d),
        }),
        CASE_REOPENED_ASSIGNED: (d) => ({
            subject: `Case Reopened and Assigned: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseReopened(d),
        }),
        CASE_REOPENED_AVAILABLE: (d) => ({
            subject: `Case Reopened - Available in Queue: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseReopenedAvailable(d),
        }),
        CASE_REOPENING_REJECTED: (d) => ({
            subject: `Case Reopening Request Rejected: ${d.caseId}`,
            html: EMAIL_TEMPLATES.caseReopeningRejected(d),
        }),
        TASK_SLA_WARNING: (d) => ({
            subject: `SLA Warning: Task ${d.taskName} Approaching Deadline`,
            html: EMAIL_TEMPLATES.slaWarning(d),
        }),
        TASK_SLA_BREACH: (d) => ({
            subject: `SLA BREACH: Task ${d.taskName} Overdue - ${d.severity} Priority`,
            html: EMAIL_TEMPLATES.slaBreach(d),
        }),
        TASK_OVERDUE: (d) => ({
            subject: `Overdue Task: ${d.taskName} Requires Attention`,
            html: EMAIL_TEMPLATES.taskOverdue(d),
        }),
        GENERIC: (d) => ({
            subject: 'CMS Notification',
            html: EMAIL_TEMPLATES.generic(d),
        }),
    };

    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        private readonly asyncTaskService: AsyncTaskService,
        @Optional() private readonly userService?: UserService,
    ) { }

    async sendNotification(payload: NotificationPayload): Promise<void> {
        this.logger.log(`Dispatching ${payload.type} notification for user ${payload.userId}`);
        const email = await this.resolveUserEmail(payload.userId);
        await this.dispatchNotification(email, payload.type, payload.metadata || {}, {
            notificationType: payload.type,
            userId: payload.userId,
        });
    }
    /**
     * Handle task unassigned events
     * Sends notifications when a task is unassigned from a user
     */
    @OnEvent('task.unassigned')
    async handleTaskUnassigned(payload: TaskEventPayload): Promise<void> {
        this.logger.log(`Task Unassigned: Task ${payload.taskId} unassigned from user ${payload.assignedUserId}`);

        const email = await this.resolveUserEmail(payload.assignedUserId);
        await this.dispatchNotification(email, 'TASK_UNASSIGNED', {
            taskTitle: payload.taskName,
            reason: 'Task has been unassigned',
        }, payload);
    }
    async sendGroupNotification(payload: GroupNotificationPayload): Promise<void> {
        this.logger.log(`Dispatching ${payload.type} group notification for ${payload.candidateGroup}`);
        const groupEmails: string[] = payload.metadata?.groupEmails || [];

        await this.dispatchNotificationToMultiple(groupEmails, payload.type, payload.metadata || {}, {
            notificationType: payload.type,
            candidateGroup: payload.candidateGroup,
        });
    }

    /**
     * @deprecated Use sendNotification with CASE_SUSPENDED type instead
     */
    async sendCaseSuspensionEmail(to: string, caseId: string, suspendedBy: string, reason: string): Promise<void> {
        await this.dispatchNotification(to, 'CASE_SUSPENDED', {
            caseId,
            actionBy: suspendedBy,
            reason,
        }, { caseId, suspendedBy, reason });
    }

    /**
     * @deprecated Use sendNotification with CASE_RESUMED type instead
     */
    async sendCaseResumptionEmail(to: string, caseId: string, resumedBy: string, reason: string): Promise<void> {
        await this.dispatchNotification(to, 'CASE_RESUMED', {
            caseId,
            actionBy: resumedBy,
            reason,
        }, { caseId, resumedBy, reason });
    }

    /**
     * Handle SLA warning events
     * Sends notifications to supervisors when tasks are approaching their deadlines
     */
    @OnEvent('task.sla-warning')
    async handleSlaWarning(payload: SlaWarningPayload): Promise<void> {
        this.logger.warn(`SLA Warning: Task ${payload.taskId} approaching deadline`);
        await this.handleSlaNotification('TASK_SLA_WARNING', payload);
    }

    /**
     * Handle SLA breach events
     * Sends urgent notifications when tasks exceed their SLA deadlines
     */
    @OnEvent('task.sla-breach')
    async handleSlaBreach(payload: SlaBreachPayload): Promise<void> {
        this.logger.error(`SLA BREACH: Task ${payload.taskId} has breached SLA - Severity: ${payload.severity}`);

        await this.handleSlaNotification('TASK_SLA_BREACH', payload);

        // Critical breaches also notify management
        if (payload.severity === 'CRITICAL') {
            const managementEmail = this.config.get<string>('MANAGEMENT_EMAIL');
            if (managementEmail) {
                await this.dispatchNotification(managementEmail, 'TASK_SLA_BREACH', payload, payload);
            }
        }
    }

    /**
     * Handle overdue task events
     * Sends notifications when tasks have been open for an extended period
     */
    @OnEvent('task.overdue')
    async handleOverdueTask(payload: OverdueTaskPayload): Promise<void> {
        this.logger.warn(`Overdue Task: Task ${payload.taskId} has been open for ${payload.hoursSinceCreation} hours`);
        await this.handleSlaNotification('TASK_OVERDUE', payload);
    }

    /**
     * Handle task assigned events
     * Sends notifications when a task is assigned to a user
     */
    @OnEvent('task.assigned')
    async handleTaskAssigned(payload: TaskEventPayload): Promise<void> {
        this.logger.log(`Task Assigned: Task ${payload.taskId} assigned to user ${payload.assignedUserId}`);

        const email = await this.resolveUserEmail(payload.assignedUserId);
        await this.dispatchNotification(email, 'TASK_ASSIGNED', {
            taskTitle: payload.taskName,
            taskType: payload.taskType,
            caseNumber: payload.caseNumber,
            priority: payload.casePriority,
            deadline: payload.slaDeadline || 'Not set',
            workQueue: payload.workQueueName,
            assignedBy: payload.assignedBy || 'System',
        }, payload);
    }

    /**
     * Handle task reassigned events
     * Sends notifications when a task is reassigned to a different user
     */
    @OnEvent('task.reassigned')
    async handleTaskReassigned(payload: TaskReassignedPayload): Promise<void> {
        this.logger.log(
            `Task Reassigned: Task ${payload.taskId} reassigned from ${payload.previousAssignedUserId} to ${payload.newAssignedUserId}`,
        );

        const templateData = {
            taskTitle: payload.taskName,
            taskType: payload.taskType,
            caseNumber: payload.caseNumber,
            priority: payload.casePriority,
            deadline: payload.slaDeadline || 'Not set',
            workQueue: payload.workQueueName,
            reassignedBy: payload.reassignedBy || 'System',
            reason: payload.reason || 'No reason provided',
        };

        // Notify new assignee
        const newEmail = await this.resolveUserEmail(payload.newAssignedUserId);
        await this.dispatchNotification(newEmail, 'TASK_REASSIGNED', templateData, payload);

        // Notify previous assignee about unassignment
        const prevEmail = await this.resolveUserEmail(payload.previousAssignedUserId);
        await this.dispatchNotification(prevEmail, 'TASK_UNASSIGNED', {
            taskTitle: payload.taskName,
            reason: payload.reason || 'Task was reassigned to another user',
        }, payload);
    }

    /**
     * Resolve user email from UserService or generate fallback
     */
    private async resolveUserEmail(userId: string): Promise<string> {
        if (!this.userService) {
            return `user-${userId}@example.com`;
        }

        try {
            const userEmail = await this.userService.getUserEmail(userId);
            return userEmail || `user-${userId}@example.com`;
        } catch (error) {
            this.logger.warn(`Failed to resolve email for user ${userId}: ${error.message}`);
            return `user-${userId}@example.com`;
        }
    }

    /**
     * Dispatch notification to a single recipient
     */
    private async dispatchNotification(
        email: string,
        type: NotificationType,
        templateData: Record<string, any>,
        metadata: Record<string, any>
    ): Promise<void> {
        const template = this.getTemplate(type, templateData);
        await this.asyncTaskService.createEmailTask(
            email,
            template.subject,
            template.html,
            { ...templateData, ...metadata }
        );
    }

    /**
     * Dispatch notification to multiple recipients
     */
    private async dispatchNotificationToMultiple(
        emails: string[],
        type: NotificationType,
        templateData: Record<string, any>,
        metadata: Record<string, any>
    ): Promise<void> {
        const template = this.getTemplate(type, templateData);

        const promises = emails.map(email =>
            this.asyncTaskService.createEmailTask(
                email,
                template.subject,
                template.html,
                { ...templateData, ...metadata }
            )
        );

        await Promise.all(promises);
    }

    /**
     * Handle SLA-related notifications (warnings, breaches, overdue)
     */
    private async handleSlaNotification(type: NotificationType, payload: SlaEventPayload): Promise<void> {
        const recipients: string[] = [];

        // Add supervisor email if configured
        const supervisorEmail = this.config.get<string>('SUPERVISOR_EMAIL');
        if (supervisorEmail) {
            recipients.push(supervisorEmail);
        }

        // Add assigned user if present
        if (payload.assignedUserId) {
            const userEmail = await this.resolveUserEmail(payload.assignedUserId);
            recipients.push(userEmail);
        }

        if (recipients.length > 0) {
            await this.dispatchNotificationToMultiple(recipients, type, payload, payload);
        }
    }

    /**
     * Get email template for notification type
     */
    private getTemplate(type: NotificationType, data: Record<string, any> = {}): EmailTemplate {
        const builder = this.templateMap[type] ?? this.templateMap.GENERIC;
        return builder(data);
    }
}
