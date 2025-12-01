import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../shared/user.service';
import { AsyncTaskService } from '../async-task/async-task.service';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_AVAILABLE'
  | 'TASK_UNASSIGNED'
  | 'TASK_REASSIGNED'
  | 'WORK_QUEUE'
  | 'CASE_SUSPENDED'
  | 'CASE_RESUMED'
  | 'CASE_CLOSURE_PENDING'
  | 'CASE_CLOSURE_APPROVED'
  | 'CASE_CLOSURE_REJECTED'
  | 'CASE_REOPENED_ASSIGNED'
  | 'CASE_REOPENED_AVAILABLE'
  | 'CASE_REOPENING_REJECTED'
  | 'TASK_SLA_WARNING'
  | 'TASK_SLA_BREACH'
  | 'TASK_OVERDUE'
  | 'GENERIC';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

export interface GroupNotificationPayload {
  candidateGroup: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly asyncTaskService: AsyncTaskService,
    @Optional() private readonly userService?: UserService,
  ) {}

  async sendNotification(payload: NotificationPayload): Promise<void> {
    this.logger.log(`Dispatching ${payload.type} notification for user ${payload.userId}`);
    const template = this.getTemplate(payload.type, payload.metadata);

    // Get user email from UserService
    const userEmail = this.userService ? await this.userService.getUserEmail(payload.userId) : null;
    const email = userEmail || `user-${payload.userId}@example.com`;
console.log(template.subject, "<---subject")

    // Queue email instead of sending directly
    await this.asyncTaskService.createEmailTask(
      email,
      template.subject,
      template.html,
      {
        ...payload.metadata,
        notificationType: payload.type,
        userId: payload.userId,
      },
    );
  }

  async sendGroupNotification(payload: GroupNotificationPayload): Promise<void> {
    this.logger.log(`Dispatching ${payload.type} group notification for ${payload.candidateGroup}`);
    const template = this.getTemplate(payload.type, payload.metadata);
    const groupEmails: string[] = payload.metadata?.groupEmails || [];

    // Queue all emails
    for (const email of groupEmails) {
      await this.asyncTaskService.createEmailTask(
        email,
        template.subject,
        template.html,
        {
          ...payload.metadata,
          notificationType: payload.type,
          candidateGroup: payload.candidateGroup,
        },
      );
    }
  }

  async sendCaseSuspensionEmail(to: string, caseId: string, suspendedBy: string, reason: string): Promise<void> {
    const template = this.getTemplate('CASE_SUSPENDED', {
      caseId,
      actionBy: suspendedBy,
      reason,
    });
    await this.asyncTaskService.createEmailTask(to, template.subject, template.html, { caseId, suspendedBy, reason });
  }

  async sendCaseResumptionEmail(to: string, caseId: string, resumedBy: string, reason: string): Promise<void> {
    const template = this.getTemplate('CASE_RESUMED', {
      caseId,
      actionBy: resumedBy,
      reason,
    });
    await this.asyncTaskService.createEmailTask(to, template.subject, template.html, { caseId, resumedBy, reason });
  }

  /**
   * Handle SLA warning events
   * Sends notifications to supervisors when tasks are approaching their deadlines
   */
  @OnEvent('task.sla-warning')
  async handleSlaWarning(payload: {
    taskId: string;
    taskName: string;
    caseId: string;
    casePriority: string;
    workQueueId: string;
    workQueueName: string;
    assignedUserId?: string;
    deadline: string;
    timeUntilDeadline: number;
    tenantId: string;
  }): Promise<void> {
    this.logger.warn(`SLA Warning: Task ${payload.taskId} approaching deadline`);

    const supervisorEmail = this.config.get<string>('SUPERVISOR_EMAIL');
    if (supervisorEmail) {
      const template = this.getTemplate('TASK_SLA_WARNING', payload);
      await this.asyncTaskService.createEmailTask(supervisorEmail, template.subject, template.html, payload);
    }

    if (payload.assignedUserId) {
      const userEmail = this.userService ? await this.userService.getUserEmail(payload.assignedUserId) : null;
      const email = userEmail || `user-${payload.assignedUserId}@example.com`;
      const template = this.getTemplate('TASK_SLA_WARNING', payload);
      await this.asyncTaskService.createEmailTask(email, template.subject, template.html, payload);
    }
  }

  /**
   * Handle SLA breach events
   * Sends urgent notifications when tasks exceed their SLA deadlines
   */
  @OnEvent('task.sla-breach')
  async handleSlaBreach(payload: {
    taskId: string;
    taskName: string;
    caseId: string;
    casePriority: string;
    workQueueId: string;
    workQueueName: string;
    assignedUserId?: string;
    deadline: string;
    breachDuration: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    tenantId: string;
  }): Promise<void> {
    this.logger.error(`SLA BREACH: Task ${payload.taskId} has breached SLA - Severity: ${payload.severity}`);

    const supervisorEmail = this.config.get<string>('SUPERVISOR_EMAIL');
    if (supervisorEmail) {
      const template = this.getTemplate('TASK_SLA_BREACH', payload);
      await this.asyncTaskService.createEmailTask(supervisorEmail, template.subject, template.html, payload);
    }

    if (payload.severity === 'CRITICAL') {
      const managementEmail = this.config.get<string>('MANAGEMENT_EMAIL');
      if (managementEmail) {
        const template = this.getTemplate('TASK_SLA_BREACH', payload);
        await this.asyncTaskService.createEmailTask(managementEmail, template.subject, template.html, payload);
      }
    }

    if (payload.assignedUserId) {
      const userEmail = this.userService ? await this.userService.getUserEmail(payload.assignedUserId) : null;
      const email = userEmail || `user-${payload.assignedUserId}@example.com`;
      const template = this.getTemplate('TASK_SLA_BREACH', payload);
      await this.asyncTaskService.createEmailTask(email, template.subject, template.html, payload);
    }
  }

  /**
   * Handle overdue task events
   * Sends notifications when tasks have been open for an extended period
   */
  @OnEvent('task.overdue')
  async handleOverdueTask(payload: {
    taskId: string;
    taskName: string;
    caseId: string;
    casePriority: string;
    workQueueId: string;
    workQueueName: string;
    assignedUserId?: string;
    createdAt: string;
    hoursSinceCreation: number;
    tenantId: string;
  }): Promise<void> {
    this.logger.warn(`Overdue Task: Task ${payload.taskId} has been open for ${payload.hoursSinceCreation} hours`);

    const supervisorEmail = this.config.get<string>('SUPERVISOR_EMAIL');
    if (supervisorEmail) {
      const template = this.getTemplate('TASK_OVERDUE', payload);
      await this.asyncTaskService.createEmailTask(supervisorEmail, template.subject, template.html, payload);
    }

    if (payload.assignedUserId) {
      const userEmail = this.userService ? await this.userService.getUserEmail(payload.assignedUserId) : null;
      const email = userEmail || `user-${payload.assignedUserId}@example.com`;
      const template = this.getTemplate('TASK_OVERDUE', payload);
      await this.asyncTaskService.createEmailTask(email, template.subject, template.html, payload);
    }
  }

  /**
   * Handle task assigned events
   * Sends notifications when a task is assigned to a user
   */
  @OnEvent('task.assigned')
  async handleTaskAssigned(payload: {
    taskId: string;
    taskName: string;
    taskType: string;
    caseId: string;
    caseNumber: string;
    casePriority: string;
    assignedUserId: string;
    assignedBy?: string;
    slaDeadline?: string;
    workQueueName: string;
    tenantId: string;
  }): Promise<void> {
    this.logger.log(`Task Assigned: Task ${payload.taskId} assigned to user ${payload.assignedUserId}`);

    const userEmail = this.userService ? await this.userService.getUserEmail(payload.assignedUserId) : null;
    const email = userEmail || `user-${payload.assignedUserId}@example.com`;
    const template = this.getTemplate('TASK_ASSIGNED', {
      taskTitle: payload.taskName,
      taskType: payload.taskType,
      caseNumber: payload.caseNumber,
      priority: payload.casePriority,
      deadline: payload.slaDeadline || 'Not set',
      workQueue: payload.workQueueName,
      assignedBy: payload.assignedBy || 'System',
    });
console.log(template.subject, "<---subject")
    await this.asyncTaskService.createEmailTask(email, template.subject, template.html, payload);
  }

  /**
   * Handle task reassigned events
   * Sends notifications when a task is reassigned to a different user
   */
  @OnEvent('task.reassigned')
  async handleTaskReassigned(payload: {
    taskId: string;
    taskName: string;
    taskType: string;
    caseId: string;
    caseNumber: string;
    casePriority: string;
    previousAssignedUserId: string;
    newAssignedUserId: string;
    reassignedBy?: string;
    reason?: string;
    slaDeadline?: string;
    workQueueName: string;
    tenantId: string;
  }): Promise<void> {
    this.logger.log(
      `Task Reassigned: Task ${payload.taskId} reassigned from ${payload.previousAssignedUserId} to ${payload.newAssignedUserId}`,
    );

    // Notify new assignee
    const newUserEmail = this.userService ? await this.userService.getUserEmail(payload.newAssignedUserId) : null;
    const newEmail = newUserEmail || `user-${payload.newAssignedUserId}@example.com`;
    const newUserTemplate = this.getTemplate('TASK_REASSIGNED', {
      taskTitle: payload.taskName,
      taskType: payload.taskType,
      caseNumber: payload.caseNumber,
      priority: payload.casePriority,
      deadline: payload.slaDeadline || 'Not set',
      workQueue: payload.workQueueName,
      reassignedBy: payload.reassignedBy || 'System',
      reason: payload.reason || 'No reason provided',
    });
    await this.asyncTaskService.createEmailTask(newEmail, newUserTemplate.subject, newUserTemplate.html, payload);

    // Optionally notify previous assignee about unassignment
    const prevUserEmail = this.userService ? await this.userService.getUserEmail(payload.previousAssignedUserId) : null;
    const prevEmail = prevUserEmail || `user-${payload.previousAssignedUserId}@example.com`;
    const prevUserTemplate = this.getTemplate('TASK_UNASSIGNED', {
      taskTitle: payload.taskName,
      reason: payload.reason || 'Task was reassigned to another user',
    });
    await this.asyncTaskService.createEmailTask(prevEmail, prevUserTemplate.subject, prevUserTemplate.html, payload);
  }

  private getTemplate(type: NotificationType, data: Record<string, any> = {}): { subject: string; html: string } {
    const templates: Record<NotificationType, (data: Record<string, any>) => { subject: string; html: string }> = {
      TASK_ASSIGNED: (d) => ({
        subject: `New Task Assigned: ${d.taskTitle}`,
        html: this.taskTemplate('assigned', d),
      }),
      TASK_UNASSIGNED: (d) => ({
        subject: `Task Unassigned: ${d.taskTitle}`,
        html: this.taskTemplate('unassigned', d),
      }),
      TASK_REASSIGNED: (d) => ({
        subject: `Task Reassigned: ${d.taskTitle}`,
        html: this.taskTemplate('reassigned', d),
      }),
      WORK_QUEUE: (d) => ({
        subject: `New Task in ${d.candidateGroup} Queue`,
        html: this.workQueueTemplate(d),
      }),
      TASK_AVAILABLE: (d) => ({
        subject: 'Task Available in Queue',
        html: this.workQueueTemplate(d),
      }),
      CASE_SUSPENDED: (d) => ({
        subject: `Case Suspended: ${d.caseId}`,
        html: this.caseTemplate('suspended', d),
      }),
      CASE_RESUMED: (d) => ({
        subject: `Case Resumed: ${d.caseId}`,
        html: this.caseTemplate('resumed', d),
      }),
      CASE_CLOSURE_PENDING: (d) => ({
        subject: `Case Closure Pending Approval: ${d.caseId}`,
        html: this.caseClosurePendingTemplate(d),
      }),
      CASE_CLOSURE_APPROVED: (d) => ({
        subject: `Case Closure Approved: ${d.caseId}`,
        html: this.caseClosureApprovedTemplate(d),
      }),
      CASE_CLOSURE_REJECTED: (d) => ({
        subject: `Case Closure Rejected: ${d.caseId}`,
        html: this.caseClosureRejectedTemplate(d),
      }),
      CASE_REOPENED_ASSIGNED: (d) => ({
        subject: `Case Reopened and Assigned: ${d.caseId}`,
        html: this.caseReopenedTemplate(d),
      }),
      CASE_REOPENED_AVAILABLE: (d) => ({
        subject: `Case Reopened - Available in Queue: ${d.caseId}`,
        html: this.caseReopenedAvailableTemplate(d),
      }),
      CASE_REOPENING_REJECTED: (d) => ({
        subject: `Case Reopening Request Rejected: ${d.caseId}`,
        html: this.caseReopeningRejectedTemplate(d),
      }),
      TASK_SLA_WARNING: (d) => ({
        subject: `SLA Warning: Task ${d.taskName} Approaching Deadline`,
        html: this.slaWarningTemplate(d),
      }),
      TASK_SLA_BREACH: (d) => ({
        subject: `SLA BREACH: Task ${d.taskName} Overdue - ${d.severity} Priority`,
        html: this.slaBreachTemplate(d),
      }),
      TASK_OVERDUE: (d) => ({
        subject: `Overdue Task: ${d.taskName} Requires Attention`,
        html: this.taskOverdueTemplate(d),
      }),
      GENERIC: (d) => ({
        subject: 'CMS Notification',
        html: `<p>${d.message}</p>`,
      }),
    };

    const builder = templates[type] ?? templates.GENERIC;
    return builder(data);
  }

  private taskTemplate(action: 'assigned' | 'unassigned' | 'reassigned', data: Record<string, any>): string {
    const reason = data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : '';
    const extra = data.reassignedBy && `<li><strong>Reassigned By:</strong> ${data.reassignedBy}</li>`;

    return `
      <p>Hello,</p>
      <p>Task <strong>${data.taskTitle}</strong> (ID: ${data.taskId}) has been ${action}.</p>
      <ul>${reason}${extra || ''}</ul>
      <p>Please check the Case Management System to take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private workQueueTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>A new task is available in the <strong>${data.candidateGroup}</strong> work queue:</p>
      <ul>
        <li><strong>Task:</strong> ${data.taskTitle}</li>
        <li><strong>Task ID:</strong> ${data.taskId}</li>
      </ul>
      <p>Please check the Case Management System to claim this task.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseTemplate(status: 'suspended' | 'resumed', data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Your case <strong>${data.caseId}</strong> has been ${status}.</p>
      <ul>
        <li><strong>${status === 'suspended' ? 'Suspended By' : 'Resumed By'}:</strong> ${data.actionBy}</li>
        <li><strong>Reason:</strong> ${data.reason}</li>
      </ul>
      <p>The case is now ${status === 'suspended' ? 'on hold' : 'active again'}.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseClosurePendingTemplate(data: Record<string, any>): string {
    return `
      <p>Hello Supervisor,</p>
      <p>Case <strong>${data.caseId}</strong> has been submitted for closure approval.</p>
      <ul>
        <li><strong>Recommended Outcome:</strong> ${data.recommendedOutcome}</li>
        <li><strong>Submitted By:</strong> ${data.submittedBy}</li>
        <li><strong>Approval Task ID:</strong> ${data.approvalTaskId}</li>
      </ul>
      <p>Please review and approve or reject the case closure.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseClosureApprovedTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Your case closure for case <strong>${data.caseId}</strong> has been approved.</p>
      <ul>
        <li><strong>Final Outcome:</strong> ${data.finalOutcome}</li>
        <li><strong>Approved By:</strong> ${data.approvedBy}</li>
        ${data.supervisorComments ? `<li><strong>Comments:</strong> ${data.supervisorComments}</li>` : ''}
      </ul>
      <p>The case has been successfully closed.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseClosureRejectedTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Your case closure request for case <strong>${data.caseId}</strong> has been rejected.</p>
      <h3>Supervisor Feedback:</h3>
      <blockquote style="border-left: 3px solid #dc3545; padding-left: 15px; color: #555;">
        ${data.supervisorComments}
      </blockquote>
      <h3>Next Steps:</h3>
      <ul>
        <li>A new "Investigate Case" task has been assigned to you (Task ID: ${data.taskId})</li>
        <li>Review the supervisor's feedback carefully</li>
        <li>Address the concerns raised</li>
        <li>Resubmit for closure approval when ready</li>
      </ul>
      <p>Rejected By: ${data.rejectedBy}</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseReopenedTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Case <strong>${data.caseId}</strong> has been reopened and assigned to you.</p>
      <ul>
        <li><strong>Task ID:</strong> ${data.taskId}</li>
        <li><strong>Approved By:</strong> ${data.approvedBy}</li>
        ${data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : ''}
      </ul>
      <p>Please review the case and conduct additional investigation as needed.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseReopenedAvailableTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Case <strong>${data.caseId}</strong> has been reopened and is now available in the investigations work queue.</p>
      <ul>
        <li><strong>Task ID:</strong> ${data.taskId}</li>
        <li><strong>Approved By:</strong> ${data.approvedBy}</li>
      </ul>
      <p>Please check the Case Management System to claim this case.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private caseReopeningRejectedTemplate(data: Record<string, any>): string {
    return `
      <p>Hello,</p>
      <p>Your case reopening request for case <strong>${data.caseId}</strong> has been rejected.</p>
      <h3>Rejection Reason:</h3>
      <blockquote style="border-left: 3px solid #dc3545; padding-left: 15px; color: #555;">
        ${data.rejectionReason}
      </blockquote>
      <p>The case has been restored to its original status: <strong>${data.restoredStatus}</strong></p>
      <p>Rejected By: ${data.rejectedBy}</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  }

  private slaWarningTemplate(data: Record<string, any>): string {
    const timeRemaining = data.timeUntilDeadline ? `${Math.abs(data.timeUntilDeadline)} minutes` : 'Unknown';

    return `
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 10px 0;">
        <h2 style="color: #856404; margin-top: 0;">SLA Warning</h2>
        <p>A task in your work queue is approaching its SLA deadline and requires attention.</p>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${data.casePriority === 'HIGH' ? '#dc3545' : data.casePriority === 'MEDIUM' ? '#ffc107' : '#28a745'};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #fff3cd;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Time Remaining:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #856404;">${timeRemaining}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>SLA Deadline:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.deadline || 'N/A'}</td>
          </tr>
        </table>
        
        <p style="margin-top: 20px;">Please prioritize this task to avoid an SLA breach.</p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  }

  private slaBreachTemplate(data: Record<string, any>): string {
    const breachDuration = data.breachDuration ? `${Math.abs(data.breachDuration)} minutes` : 'Unknown';

    const severityColor =
      {
        CRITICAL: '#dc3545',
        HIGH: '#fd7e14',
        MEDIUM: '#ffc107',
        LOW: '#6c757d',
        INFO: '#17a2b8',
      }[data.severity] || '#dc3545';

    return `
      <div style="background-color: #f8d7da; border-left: 4px solid ${severityColor}; padding: 20px; margin: 10px 0;">
        <h2 style="color: #721c24; margin-top: 0;">SLA BREACH ALERT</h2>
        <p style="color: #721c24; font-size: 16px;"><strong>A task has breached its SLA deadline and requires immediate action!</strong></p>
        
        <div style="background-color: ${severityColor}; color: white; padding: 10px; margin: 10px 0; text-align: center; border-radius: 5px;">
          <h3 style="margin: 0;">Severity: ${data.severity}</h3>
        </div>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${data.casePriority === 'HIGH' ? '#dc3545' : data.casePriority === 'MEDIUM' ? '#ffc107' : '#28a745'};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #f8d7da;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Breach Duration:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #721c24;">${breachDuration} OVERDUE</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>SLA Deadline Was:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.deadline || 'N/A'}</td>
          </tr>
        </table>
        
        <h3 style="color: #721c24; margin-top: 20px;">Required Actions:</h3>
        <ul style="color: #721c24;">
          <li>Escalate to supervisor immediately if not already assigned</li>
          <li>Prioritize completion of this task</li>
          <li>Document any reasons for the delay</li>
          <li>Update task status regularly</li>
        </ul>
        
        <p style="margin-top: 20px; color: #721c24;"><strong>This breach has been logged for reporting purposes.</strong></p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  }

  private taskOverdueTemplate(data: Record<string, any>): string {
    const hoursSinceCreation = data.hoursSinceCreation || 'Unknown';

    return `
      <div style="background-color: #e2e3e5; border-left: 4px solid #6c757d; padding: 20px; margin: 10px 0;">
        <h2 style="color: #383d41; margin-top: 0;">Overdue Task Alert</h2>
        <p>A task has been open for an extended period and may require attention or escalation.</p>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${data.casePriority === 'HIGH' ? '#dc3545' : data.casePriority === 'MEDIUM' ? '#ffc107' : '#28a745'};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #e2e3e5;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Time Open:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #383d41;">${hoursSinceCreation} hours</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Created At:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.createdAt || 'N/A'}</td>
          </tr>
        </table>
        
        <h3 style="color: #383d41; margin-top: 20px;">Recommended Actions:</h3>
        <ul>
          <li>Review task status and progress</li>
          <li>Check for any blockers or impediments</li>
          <li>Consider reassignment if necessary</li>
          <li>Update task priority if warranted</li>
          <li>Add comments documenting current status</li>
        </ul>
        
        <p style="margin-top: 20px;">Please review this task to ensure it receives appropriate attention.</p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  }
}
