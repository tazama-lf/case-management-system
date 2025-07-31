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
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto, userId: string, tenantId: string) {
    // Determine the alert source
    let source = 'NATS'; 
    if (dto.result && typeof dto.result.source === 'string' && dto.result.source) {
      source = dto.result.source;
    } else if (
      dto.result &&
      dto.result.report &&
      typeof (dto.result.report as any).source === 'string' &&
      (dto.result.report as any).source
    ) {
      source = (dto.result.report as any).source;
    }

    // Determine the alert type (txtp)
    let txtp = '';
    if (dto.result.report && typeof (dto.result.report as any).txtp === 'string') {
      txtp = (dto.result.report as any).txtp;
    } else if (dto.result.transaction && typeof (dto.result.transaction as any).txtp === 'string') {
      txtp = (dto.result.transaction as any).txtp;
    } else if (dto.result.networkMap && typeof (dto.result.networkMap as any).txtp === 'string') {
      txtp = (dto.result.networkMap as any).txtp;
    }

    try {
      const alert = await this.prisma.alert.create({
        data: {
          tenant_id: tenantId, 
          priority: Priority.LOW,
          source: source, 
          txtp: txtp, // Set based on alert type
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

  async updateAlertData(alertId: string, dto: UpdateAlertDto, userId: string) {
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
        userId,
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

  async manualCloseAlert(alertId: string, status: AlertStatus, userId: string) {
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
}