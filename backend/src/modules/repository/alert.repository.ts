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

  async createAlert(alertData: CreateAlertDTO, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const alert_data = JSON.parse(JSON.stringify(alertData.report));
      const transaction = JSON.parse(JSON.stringify(alertData.transaction));
      const network_map = JSON.parse(JSON.stringify(alertData.networkMap));
      const createdAlert = await client.alert.create({
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
      throw error;
    }
  }

  async createTransaction(tenantId: string, transactionData: TransactionDTO, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      if (!transactionData || typeof transactionData !== 'object') {
        throw new Error('Invalid transaction data');
      }
      const referenceIdData = await this.getReferenceId(transactionData.TxTp);
      const referenceId = extractReferenceId(transactionData as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
      if (!referenceId) {
        throw new Error('ReferenceId not found in transaction data');
      }

      if (!referenceIdData) {
        throw new Error('ReferenceId not found in transaction data');
      }

      const transactionRecord = await client.transactionData.create({
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
      throw error;
    }
  }

  async getAlertById(alertId: number, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const alert = await client.alert.findUnique({
        where: { alert_id: alertId },
      });

      if (!alert) {
        throw new NotFoundException(`Alert with ID ${alertId} not found`);
      }

      return alert;
    } catch (error) {
      throw error;
    }
  }

  async getAlertByCaseId(caseId: number, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const alert = await client.alert.findUnique({
        where: { case_id: caseId },
      });

      if (!alert) {
        throw new NotFoundException(`Alert with Case ID ${caseId} not found`);
      }

      return alert.alert_id;
    } catch (error) {
      throw error;
    }
  }

  async updateAlert(alertId: number, updateData: UpdateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert> {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const updatedAlert = await client.alert.update({
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
      throw error;
    }
  }

  async findMany(
    options: {
      where?: Prisma.AlertWhereInput;
      sortOrder?: 'asc' | 'desc';
      sortBy?: keyof Alert;
      page?: number;
      limit?: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const { where: whereClause = {}, sortBy = 'created_at', sortOrder = 'desc', page = 1, limit = 10 } = options;

      const alerts = await client.alert.findMany({
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
      throw error;
    }
  }

  async count(options: { where?: Prisma.AlertWhereInput }, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const { where: whereClause = {} } = options;
      const totalCount = await client.alert.count({ where: whereClause });
      return totalCount;
    } catch (error) {
      throw error;
    }
  }

  async getReferenceId(txTp: string, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const referenceId = await client.referenceId.findUnique({
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
      throw error;
    }
  }
}
