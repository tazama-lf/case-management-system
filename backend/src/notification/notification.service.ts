import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface NotificationPayload {
  userId: string;
  type: string;
  message: string;
  metadata?: {
    taskId?: string;
    caseId?: string;
    unassignedBy?: string;
    reason?: string;
    [key: string]: any;
  };
}

interface GroupNotificationPayload {
  candidateGroup: string;
  type: string;
  message: string;
  metadata?: {
    taskId?: string;
    caseId?: string;
    [key: string]: any;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      this.logger.log(`Sending ${payload.type} notification to user ${payload.userId}`, NotificationService.name);

      this.logger.log(`Notification: ${payload.message} for user ${payload.userId}`, NotificationService.name);
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${payload.userId}: ${error.message}`, error.stack, NotificationService.name);
    }
  }

  async sendGroupNotification(payload: GroupNotificationPayload): Promise<void> {
    try {
      this.logger.log(`Sending ${payload.type} notification to group ${payload.candidateGroup}`, NotificationService.name);

      this.logger.log(`Group Notification: ${payload.message} for group ${payload.candidateGroup}`, NotificationService.name);
    } catch (error) {
      this.logger.error(
        `Failed to send group notification to ${payload.candidateGroup}: ${error.message}`,
        error.stack,
        NotificationService.name,
      );
    }
  }

  /**
   * Send task assignment email
   */
  async sendTaskAssignmentEmail(to: string, taskTitle: string, taskId: string): Promise<void> {
    const subject = `New Task Assigned: ${taskTitle}`;
    const html = `
      <p>Hello,</p>
      <p>You have been assigned a new task:</p>
      <ul>
        <li><strong>Task:</strong> ${taskTitle}</li>
        <li><strong>Task ID:</strong> ${taskId}</li>
      </ul>
      <p>Please check the Case Management System to take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
        to,
        subject,
        html,
      });
      this.logger.log(`Task assignment email sent to ${to} for task ${taskId}`);
    } catch (error) {
      this.logger.warn(`Failed to send task email to ${to}: ${error.message}`);
    }
  }

  /**
   * Send task unassignment email
   */
  async sendTaskUnassignmentEmail(to: string, taskTitle: string, taskId: string, reason?: string): Promise<void> {
    const subject = `Task Unassigned: ${taskTitle}`;
    const html = `
      <p>Hello,</p>
      <p>A task has been unassigned from you:</p>
      <ul>
        <li><strong>Task:</strong> ${taskTitle}</li>
        <li><strong>Task ID:</strong> ${taskId}</li>
        ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
      </ul>
      <p>The task has been returned to the work queue.</p>
      <p>Regards,<br/>CMS Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
        to,
        subject,
        html,
      });
      this.logger.log(`Task unassignment email sent to ${to} for task ${taskId}`);
    } catch (error) {
      this.logger.warn(`Failed to send unassignment email to ${to}: ${error.message}`);
    }
  }

  /**
   * Send task reassignment email
   */
  async sendTaskReassignmentEmail(to: string, taskTitle: string, taskId: string, reassignedBy: string): Promise<void> {
    const subject = `Task Reassigned: ${taskTitle}`;
    const html = `
      <p>Hello,</p>
      <p>You have been assigned a task:</p>
      <ul>
        <li><strong>Task:</strong> ${taskTitle}</li>
        <li><strong>Task ID:</strong> ${taskId}</li>
        <li><strong>Reassigned by:</strong> ${reassignedBy}</li>
      </ul>
      <p>Please check the Case Management System to take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
        to,
        subject,
        html,
      });
      this.logger.log(`Task reassignment email sent to ${to} for task ${taskId}`);
    } catch (error) {
      this.logger.warn(`Failed to send reassignment email to ${to}: ${error.message}`);
    }
  }

  /**
   * Send work queue notification email to group members
   */
  async sendWorkQueueNotificationEmail(groupEmails: string[], taskTitle: string, taskId: string, candidateGroup: string): Promise<void> {
    const subject = `New Task Available in ${candidateGroup} Queue`;
    const html = `
      <p>Hello,</p>
      <p>A new task is available in the <strong>${candidateGroup}</strong> work queue:</p>
      <ul>
        <li><strong>Task:</strong> ${taskTitle}</li>
        <li><strong>Task ID:</strong> ${taskId}</li>
      </ul>
      <p>Please check the Case Management System to claim this task.</p>
      <p>Regards,<br/>CMS Team</p>
    `;

    try {
      for (const email of groupEmails) {
        await this.transporter.sendMail({
          from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
          to: email,
          subject,
          html,
        });
      }
      this.logger.log(`Work queue notification sent to ${groupEmails.length} members of ${candidateGroup}`);
    } catch (error) {
      this.logger.warn(`Failed to send work queue notification: ${error.message}`);
    }
  }

  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    const userEmail = `user-${payload.userId}@example.com`;

    switch (payload.type) {
      case 'TASK_ASSIGNED':
        await this.sendTaskAssignmentEmail(userEmail, payload.metadata?.taskId || 'Unknown Task', payload.metadata?.taskId || '');
        break;

      case 'TASK_UNASSIGNED':
        await this.sendTaskUnassignmentEmail(
          userEmail,
          payload.metadata?.taskId || 'Unknown Task',
          payload.metadata?.taskId || '',
          payload.metadata?.reason,
        );
        break;

      case 'TASK_REASSIGNED':
        await this.sendTaskReassignmentEmail(
          userEmail,
          payload.metadata?.taskId || 'Unknown Task',
          payload.metadata?.taskId || '',
          payload.metadata?.unassignedBy || 'Unknown User',
        );
        break;

      default:
        this.logger.log(`No email handler for notification type: ${payload.type}`);
    }
  }

  async sendCaseSuspensionEmail(to: string, caseId: string, suspendedBy: string, reason: string): Promise<void> {
    const subject = `Case Suspended: ${caseId}`;
    const html = `
    <p>Hello,</p>
    <p>Your case <strong>${caseId}</strong> has been suspended.</p>
    <ul>
      <li><strong>Suspended By:</strong> ${suspendedBy}</li>
      <li><strong>Reason:</strong> ${reason}</li>
    </ul>
    <p>The case will remain suspended until the issue is resolved.</p>
    <p>Regards,<br/>CMS Team</p>
  `;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
        to,
        subject,
        html,
      });
      this.logger.log(`Case suspension email sent to ${to} for case ${caseId}`);
    } catch (error) {
      this.logger.warn(`Failed to send case suspension email to ${to}: ${error.message}`);
    }
  }

  async sendCaseResumptionEmail(to: string, caseId: string, resumedBy: string, reason: string): Promise<void> {
    const subject = `Case Resumed: ${caseId}`;
    const html = `
    <p>Hello,</p>
    <p>Your case <strong>${caseId}</strong> has been resumed.</p>
    <ul>
      <li><strong>Resumed By:</strong> ${resumedBy}</li>
      <li><strong>Reason:</strong> ${reason}</li>
    </ul>
    <p>The case is now active again for investigation.</p>
    <p>Regards,<br/>CMS Team</p>
  `;

    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || '"CMS Notifications" <no-reply@cms.local>',
        to,
        subject,
        html,
      });
      this.logger.log(`Case resumption email sent to ${to} for case ${caseId}`);
    } catch (error) {
      this.logger.warn(`Failed to send case resumption email to ${to}: ${error.message}`);
    }
  }
}
