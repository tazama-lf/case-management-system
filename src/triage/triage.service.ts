import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { AlertStatus, Priority, CaseCreationType, CaseStatus, CaseType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

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
    }
  }

  async manualCloseAlert(alertId: string, status: AlertStatus, userId: string, tenantId: string) {
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
        data: { alert_status: status },
      });

      await this.audit.logAction({
        userId,
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

  async investigateAlert(alertId: string, caseType: CaseType, userId: string, tenantId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(`Alert ${alertId} not accessible for this tenant`);
    }

    const casePriority = alert.priority ?? Priority.LOW;

    try {
      const createdCase = await this.prisma.case.create({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: tenantId,
          priority: casePriority,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: caseType,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });

      const updatedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
          case_id: createdCase.case_id,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_SENT_FOR_INVESTIGATION',
        entityName: 'Alert',
        actionPerformed: `Created case ${createdCase.case_id} for alert ${alertId}`,
        outcome: 'SUCCESS',
      });

      return updatedAlert;
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId} for investigation`, error);
      throw new InternalServerErrorException('Failed to update alert for investigation');
    }
  }
}
