import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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

  async sendTaskAssignmentEmail(to: string, taskTitle: string, taskId: string) {
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
}
