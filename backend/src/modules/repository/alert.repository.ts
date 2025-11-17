import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateAlertDTO } from '../alert/dto/CreateAlert.dto';
import { Alert } from '@prisma/client';

export class AlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAlert(alertData: CreateAlertDTO) {
    const createdAlert = await this.prisma.alert.create({
      data: {
        tenant_id: alertData.tenantId,
        priority_score: alertData.priority_score,
        priority: alertData.priority,
        alert_type: alertData.alertType,
        prediction_outcome: alertData.predictionOutcome,
        source: alertData.source,
        txtp: alertData.txtp,
        confidence_per: alertData.confidencePer,
        message: alertData.message,
        alert_data: JSON.parse(JSON.stringify(alertData.report)),
        transaction: JSON.parse(JSON.stringify(alertData.transaction)),
        network_map: JSON.parse(JSON.stringify(alertData.networkMap)),
        case_id: alertData.caseId,
      },
    });

    if (!createdAlert) {
      throw new Error('Failed to create alert');
    }

    return createdAlert;
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
