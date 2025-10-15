import { Injectable, Inject, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

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
  private readonly fromEmail: string;
  private readonly transporter: nodemailer.Transporter;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.fromEmail = this.config.get<string>('MAIL_FROM') || '"CMS Notifications" <no-reply@cms.local>';

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: parseInt(this.config.get<string>('SMTP_PORT', '587')),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    this.logger.log(`Dispatching ${payload.type} notification for user ${payload.userId}`);
    const template = this.getTemplate(payload.type, payload.metadata);
    await this.safeSendEmail(`user-${payload.userId}@example.com`, template);
  }

  async sendGroupNotification(payload: GroupNotificationPayload): Promise<void> {
    this.logger.log(`Dispatching ${payload.type} group notification for ${payload.candidateGroup}`);
    const template = this.getTemplate(payload.type, payload.metadata);
    const groupEmails: string[] = payload.metadata?.groupEmails || [];

    for (const email of groupEmails) {
      await this.safeSendEmail(email, template);
    }
  }

  async sendCaseSuspensionEmail(to: string, caseId: string, suspendedBy: string, reason: string): Promise<void> {
    const template = this.getTemplate('CASE_SUSPENDED', {
      caseId,
      actionBy: suspendedBy,
      reason,
    });
    await this.safeSendEmail(to, template);
  }

  async sendCaseResumptionEmail(to: string, caseId: string, resumedBy: string, reason: string): Promise<void> {
    const template = this.getTemplate('CASE_RESUMED', {
      caseId,
      actionBy: resumedBy,
      reason,
    });
    await this.safeSendEmail(to, template);
  }

  private async safeSendEmail(to: string, template: { subject: string; html: string }, maxRetries = 5, delayMs = 1000): Promise<void> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject: template.subject,
          html: template.html,
        });
        this.logger.log(`Email sent to ${to}: ${template.subject}`);
        return;
      } catch (error) {
        attempt++;
        this.logger.warn(`Attempt ${attempt} failed to send email to ${to}: ${error.message}`);
        if (attempt >= maxRetries) {
          this.logger.error(`All ${maxRetries} attempts failed for sending email to ${to}`);
          return;
        }
        await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
      }
    }
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
        subject: `Task Available in Queue`,
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
}