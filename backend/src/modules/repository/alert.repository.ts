import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAlertDTO } from '../alert/dto/CreateAlert.dto';
import { Alert, Priority } from '@prisma/client';

@Injectable()
export class AlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAlert(alertData: CreateAlertDTO) {
    try {
      const alert_data = JSON.parse(JSON.stringify(alertData.report));
      const transaction = JSON.parse(JSON.stringify(alertData.transaction));
      const network_map = JSON.parse(JSON.stringify(alertData.networkMap));
      const createdAlert = await this.prisma.alert.create({
        data: {
          tenant_id: alertData.tenantId,
          priority: Priority.NEW,
          source: alertData.source,
          txtp: alertData.txtp,
          confidence_per: alertData.confidencePer,
          message: alertData.message,
          alert_data,
          transaction,
          network_map,
          case_id: alertData.caseId,
        },
      });

      if (!createdAlert) {
        throw new Error('Failed to create alert');
      }

      return createdAlert;
    } catch (error) {
      throw new Error(`Failed to create alert: ${error.message}`);
    }
  }

  async getAlertById(alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return alert;
  }

  async updateAlert(alertId: string, updateData: Partial<CreateAlertDTO>): Promise<Alert> {
    const updatedAlert = await this.prisma.alert.update({
      where: { alert_id: alertId },
      data: {
        priority_score: updateData.priority_score,
        priority: updateData.priority,
        alert_type: updateData.alertType,
        prediction_outcome: updateData.predictionOutcome,
        confidence_per: updateData.confidencePer,
        message: updateData.message,
        case_id: updateData.caseId,
      },
    });

    if (!updatedAlert) {
      throw new Error(`Failed to update alert with ID ${alertId}`);
    }

    return updatedAlert;
  }
}
