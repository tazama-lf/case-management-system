import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { IngestAlertDto } from '../../dtos/IngestAlert.dto';
import { Priority } from '@prisma/client';

@Injectable()
export class AlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly alertRepository: AlertRepository,
  ) {}

  async createNewAlert(alert: IngestAlertDto, tenantId: string, source: string, caseId: string) {
    this.loggerService.log(`Start - Alert Creation`, AlertService.name);
    const txtp = alert.transaction.TxTp;
    alert.message = alert.message ?? 'Suspicious activity detected';
    try {
      const newAlert = await this.alertRepository.createAlert({
        tenantId,
        priority: Priority.NEW,
        source: source,
        txtp: txtp,
        message: alert.message,
        report: alert.report,
        transaction: alert.transaction,
        networkMap: alert.networkMap,
        confidencePer: 0,
        caseId: caseId,
      });

      this.loggerService.log(`End - Alert Creation - ${newAlert.alert_id}`, AlertService.name);
      return newAlert;
    } catch (error) {
      this.loggerService.error(`Error creating alert: ${error.message}`, error, AlertService.name);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }
}
