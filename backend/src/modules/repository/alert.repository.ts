import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Alert, Priority, Prisma } from '@prisma/client';
import { CreateAlertDTO, UpdateAlertDTO } from '../alert/dto';

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
          case_id: alertData.caseId === '' ? null : alertData.caseId,
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

  async getAlertByCaseId(caseId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { case_id: caseId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with Case ID ${caseId} not found`);
    }

    return alert.alert_id;
  }

  async updateAlert(alertId: string, updateData: UpdateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert> {
    try {
      if (!tx) {
        tx = this.prisma;
      }
      const updatedAlert = await tx.alert.update({
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
    } catch (error) {
      throw new Error(`Failed to update alert ${alertId}: ${error.message}`);
    }
  }

  async findMany(options: {
    where?: Prisma.AlertWhereInput;
    sortOrder?: 'asc' | 'desc';
    sortBy?: keyof Alert;
    page?: number;
    limit?: number;
  }) {
    try {
      const { where: whereClause = {}, sortBy = 'created_at', sortOrder = 'desc', page = 1, limit = 10 } = options;

      const alerts = await this.prisma.alert.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          alert_id: true,
          txtp: true,
          priority: true,
          confidence_per: true,
          source: true,
          alert_type: true,
          created_at: true,
          transaction: true,
          alert_data: true,
        },
      });

      return alerts;
    } catch (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }
  }

  async count(options: { where?: Prisma.AlertWhereInput }) {
    try {
      const { where: whereClause = {} } = options;
      const totalCount = await this.prisma.alert.count({ where: whereClause });
      return totalCount;
    } catch (error) {
      throw new Error(`Failed to count alerts: ${error.message}`);
    }
  }
}
