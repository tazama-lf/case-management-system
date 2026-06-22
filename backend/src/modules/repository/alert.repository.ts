import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Alert, Priority, Prisma, TransactionData } from '@prisma/client-cms';
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

  async createAlert(alertData: CreateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const AlertData = JSON.parse(JSON.stringify(alertData.report));
    const transaction = JSON.parse(JSON.stringify(alertData.transaction));
    const networkMap = JSON.parse(JSON.stringify(alertData.networkMap));
    const createdAlert = await client.alert.create({
      data: {
        tenant_id: alertData.tenantId,
        priority: Priority.NEW,
        source: alertData.source,
        txtp: alertData.txtp,
        confidence_per: alertData.confidencePer,
        message: alertData.message,
        alert_data: AlertData,
        transaction,
        network_map: networkMap,
        case_id: alertData.caseId ? alertData.caseId : null,
      },
    });

    if (!createdAlert.alert_id) {
      throw new Error('Failed to create alert');
    }
    return createdAlert;
  }

  async createTransaction(
    tenantId: string,
    transactionData: TransactionDTO,
    tx?: Prisma.TransactionClient,
  ): Promise<TransactionData | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    if (!transactionData.TxTp) {
      throw new Error('Invalid transaction data');
    }
    const referenceIdData = await this.getReferenceId(transactionData.TxTp, tenantId);
    const referenceId = extractReferenceId(transactionData as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
    if (!referenceId) {
      throw new Error('ReferenceId not found in transaction data');
    }

    if (!referenceIdData.referenceIdName) {
      throw new Error('ReferenceId not found in transaction data');
    }

    const transactionRecord = await client.transactionData.create({
      data: {
        tenantId,
        endToEndId: referenceId,
        transactionData: JSON.parse(JSON.stringify(transactionData)),
      },
    });
    if (!transactionRecord.transactionId) {
      throw new Error('Failed to create transaction record');
    }
    return transactionRecord;
  }

  async getAlertById(alertId: number, tx?: Prisma.TransactionClient): Promise<Alert | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const alert = await client.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return alert;
  }

  async getAlertByCaseId(caseId: number, tx?: Prisma.TransactionClient): Promise<number> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const alert = await client.alert.findUnique({
      where: { case_id: caseId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with Case ID ${caseId} not found`);
    }
    return alert.alert_id;
  }

  async updateAlert(alertId: number, updateData: UpdateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
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

    if (!updatedAlert.alert_id) {
      throw new Error(`Failed to update alert with ID ${alertId}`);
    }

    return updatedAlert;
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
  ): Promise<
    Array<{
      alert_id: number;
      txtp: string;
      priority: Priority | null;
      confidence_per: number;
      source: string | null;
      alert_type: string | null;
      created_at: Date;
      transaction: Prisma.JsonValue;
      alert_data: Prisma.JsonValue;
    }>
  > {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
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
  }

  async count(options: { where?: Prisma.AlertWhereInput }, tx?: Prisma.TransactionClient): Promise<number> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const { where: whereClause = {} } = options;
    const totalCount = await client.alert.count({ where: whereClause });
    return totalCount;
  }

  async getReferenceId(txTp: string, tenantId: string, tx?: Prisma.TransactionClient): Promise<{ referenceIdName: string }> {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
      const referenceId = await client.referenceId.findFirst({
        where: {
          txTp,
          tenant_id: tenantId,
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
