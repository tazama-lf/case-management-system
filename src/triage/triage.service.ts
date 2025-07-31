<<<<<<< HEAD
import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
=======
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
>>>>>>> 98eea0c (feat(triage) :  manual alert triage)
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { AlertStatus, Priority } from '@prisma/client';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);
<<<<<<< HEAD

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto, userId: string, tenantId: string) {
    // Determine the alert source
    let source = 'REST API';
    // Determine the alert type (txtp)
    const txtp = typeof dto?.result?.transaction?.TxTp === 'string' ? dto.result.transaction.TxTp : '';

    try {
      const alert = await this.prisma.alert.create({
        data: {
          tenant_id: tenantId,
          priority: Priority.LOW,
          source: source,
          txtp: txtp,
          alert_status: AlertStatus.NEW,
          message: String(dto.result.message),
          alert_data: dto.result.report,
          transaction: dto.result.transaction,
          network_map: dto.result.networkMap,
          confidence_per: 0,
        },
      });
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CREATED',
        entityName: 'Alert',
        actionPerformed: `Created new alert ${alert.alert_id}`,
        outcome: 'SUCCESS',
      });

      return alert;
    } catch (error) {
      this.logger.error('Error creating alert', error);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlertData(alertId: string, dto: UpdateAlertDto, userId: string, tenantId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(`Alert ${alertId} not accessible for this tenant`);
    }

    try {
      const updated = await this.prisma.alert.update({
        where: {
          alert_id: alertId,
          tenant_id: tenantId,
        },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined ? `, confidence_per=${dto.confidence_per}` : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : ''),
        outcome: 'SUCCESS',
      });

      return updated;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId}`, error);
      throw new InternalServerErrorException('Failed to update alert');
  /**
   * Handles alert submission and applies auto-close logic based on business rules.
   * @param submitAlertDto - The alert data submitted for triage
   * @returns Alert response with status and audit log
   * @throws BadRequestException if required fields are missing or invalid
   */
  async handleAlert(submitAlertDto: SubmitAlertDto) {
    // Basic validation
    if (
      !submitAlertDto?.priority ||
      !submitAlertDto.tenant_id ||
      typeof submitAlertDto.confidence_per !== 'number'
    ) {
      throw new BadRequestException('Missing required alert fields.');
    }
=======
>>>>>>> 98eea0c (feat(triage) :  manual alert triage)

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto) {
    try {
      const alert = await this.prisma.alert.create({
        data: {
          tenant_id: '4b544455-9073-4af6-87a5-519bfeabe170',
          priority: Priority.LOW,
          source: '',
          txtp: '',
          alert_status: AlertStatus.NEW,
          message: dto.result.message,
          alert_data: dto.result.report,
          transaction: dto.result.transaction,
          network_map: dto.result.networkMap,
          confidence_per: 0,
        },
      });
      await this.audit.logAction({
        userId: '4b544455-9073-4af6-87a5-519bfeabe199',
        operation: 'ALERT_CREATED',
        entityName: 'Alert',
        actionPerformed: `Created new alert ${alert.alert_id}`,
        outcome: 'SUCCESS',
      });

      return alert;
    } catch (error) {
      this.logger.error('Error creating alert', error);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlertData(alertId: string, dto: UpdateAlertDto) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    try {
      const updated = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
        },
      });

      await this.audit.logAction({
        userId: '4b544455-9073-4af6-87a5-519bfeabe199',
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined
            ? `, confidence_per=${dto.confidence_per}`
            : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : ''),
        outcome: 'SUCCESS',
      });

      return updated;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId}`, error);
      throw new InternalServerErrorException('Failed to update alert');
    }
  }

  async manualCloseAlert(alertId: string, status: AlertStatus) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    try {
      const updated = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: { alert_status: status },
      });

      await this.audit.logAction({
        userId: '83513fb3-eac6-4136-b569-c65a5f0f139e',
        operation: 'ALERT_AUTO_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Auto-closed alert ${alertId} with status ${status}`,
        outcome: 'SUCCESS',
      });

      return updated;
    } catch (error) {
      this.logger.error(`Auto-close failed for alert ${alertId}`, error);
      throw new InternalServerErrorException('Failed to auto-close alert');
    }
  }
}
