import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Alert, Priority, Prisma } from '@prisma/client-cms';
import { CreateAlertDTO, UpdateAlertDTO } from '../alert/dto';
import { extractReferenceId } from './utils/extractReferenceId';
import { TransactionDTO } from 'src/dtos/Transaction.dto';
import { JsonValue } from './utils/types/JsonValue';
import { BaseRepository } from './base.repository';

@Injectable()
export class AlertRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

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
          case_id: !alertData.caseId ? null : alertData.caseId,
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

  async createTransaction(tenantId: string, transactionData: TransactionDTO) {
    try {
      if (!transactionData || typeof transactionData !== 'object') {
        throw new Error('Invalid transaction data');
      }
      const referenceIdData = await this.getReferenceId(transactionData!.TxTp);
      const referenceId = extractReferenceId(transactionData as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
      if (!referenceId) {
        throw new Error('ReferenceId not found in transaction data');
      }

      if (!referenceIdData) {
        throw new Error('ReferenceId not found in transaction data');
      }

      const transactionRecord = await this.prisma.transactionData.create({
        data: {
          tenantId,
          endToEndId: referenceId,
          transactionData: JSON.parse(JSON.stringify(transactionData)),
        },
      });
      if (!transactionRecord) {
        throw new Error('Failed to create transaction record');
      }
      return transactionRecord;
    } catch (error) {
      throw new Error(`Failed to create transaction record: ${error.message}`);
    }
  }

  async getAlertById(alertId: number) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return alert;
  }

  async getAlertByCaseId(caseId: number) {
    const alert = await this.prisma.alert.findUnique({
      where: { case_id: caseId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with Case ID ${caseId} not found`);
    }

    return alert.alert_id;
  }

  async updateAlert(alertId: number, updateData: UpdateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert> {
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

  async getReferenceId(txTp: string) {
    try {
      const referenceId = await this.prisma.referenceId.findUnique({
        where: {
          txTp,
        },
      });

      if (!referenceId) {
        throw new NotFoundException(`ReferenceId with TxTp ${txTp} not found`);
      }

      return referenceId;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to get ReferenceId with TxTp ${txTp}: ${error.message}`);
    }
  }
}
