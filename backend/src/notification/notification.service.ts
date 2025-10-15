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
      CASE_SUSPENDED: (d) => ({
        subject: `Case Suspended: ${d.caseId}`,
        html: this.caseTemplate('suspended', d),
      }),
      CASE_RESUMED: (d) => ({
        subject: `Case Resumed: ${d.caseId}`,
        html: this.caseTemplate('resumed', d),
      }),
      GENERIC: (d) => ({
        subject: 'CMS Notification',
        html: `<p>${d.message}</p>`,
      }),
      TASK_AVAILABLE: function (data: Record<string, any>): { subject: string; html: string } {
        throw new Error('Function not implemented.');
      },
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
}
