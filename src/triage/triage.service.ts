import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { AlertStatus, Priority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

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
