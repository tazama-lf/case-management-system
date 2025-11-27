import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaDWHService } from '../../prismaDWH/prismaDWH.service';
import { AuditLogService } from '../audit/auditLog.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto, DetectedAnomalyDto } from './dto/profile-response.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private prismaDWH: PrismaDWHService,
    private auditLog: AuditLogService,
  ) {}

  private formatTransactionForTable(tx: any) {
    return {
      date: tx.cre_dt_tm,
      transactionId: tx.end_to_end_id,
      type: tx.tx_tp,
      account: tx.source,
      counterparty: tx.destination,
      role: tx.role,
      amount: tx.amt?.toNumber() || 0,
    };
  }

  async generateProfile(dto: GenerateProfileDto, userId: string): Promise<ProfileResponseDto> {
    
    const tenantId = dto.filters?.tenantId || 'T001';

    const filter: any = {
      tenant_id: tenantId,
    };
    if (dto.filters?.type) {
      filter.tx_tp = dto.filters.type;
    }
    if (dto.filters?.account) {
     
      filter.OR = [{ source: dto.filters.account }, { destination: dto.filters.account }];
    }
    if (dto.filters?.role) {
      filter.role = dto.filters.role;
    }

    if (dto.filters?.dateFrom || dto.filters?.dateTo) {
      filter.cre_dt_tm = {};
      if (dto.filters?.dateFrom) filter.cre_dt_tm.gte = dto.filters.dateFrom;
      if (dto.filters?.dateTo) filter.cre_dt_tm.lte = dto.filters.dateTo;
    }

    const transactions = await this.prismaDWH.transaction.findMany({
      where: filter,
    });

    const transactionTable = transactions.map(this.formatTransactionForTable);

    const peerTransactions = await this.prismaDWH.transaction.findMany({
      where: {
        tenant_id: tenantId,
      },
    });

    const getGeography = (tx: any) => tx.transaction?.geography || tx.transaction?.TxTp || '';

    const peerBaseline = {
      avgVolume: peerTransactions.length,
      avgValue: peerTransactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() || 0), 0) / (peerTransactions.length || 1),
      avgCrossBorder: peerTransactions.filter((tx) => getGeography(tx) === 'Cross-border').length,
    };

    const metrics = {
      totalVolume: transactions.length,
      totalValue: transactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() || 0), 0),
      avgTicketSize: transactions.length ? transactions.reduce((sum, tx) => sum + (tx.amt?.toNumber() || 0), 0) / transactions.length : 0,
      crossBorderCount: transactions.filter((tx) => getGeography(tx) === 'Cross-border').length,
    };
    const outliers = transactions.filter(
      (tx) =>
        (tx.amt?.toNumber() || 0) > peerBaseline.avgValue ||
        (getGeography(tx) === 'Cross-border' && (tx.amt?.toNumber() || 0) > peerBaseline.avgCrossBorder),
    );
    const summaryTable = {
      totalVolume: metrics.totalVolume,
      totalValue: metrics.totalValue,
      avgTicketSize: metrics.avgTicketSize,
      deviationPercent: outliers.length ? ((outliers.length / metrics.totalVolume) * 100).toFixed(2) : '0.00',
    };
    const visualization = 'trend-chart-placeholder';
    const detectedAnomalies = outliers.map((tx) => ({
      date: tx.cre_dt_tm || '',
      type: tx.tx_tp,
      amount: tx.amt?.toNumber() || 0,
      description: (tx.amt?.toNumber() || 0) > peerBaseline.avgValue ? 'Large transaction flagged' : 'Cross-border anomaly',
      risk: (tx.amt?.toNumber() || 0) > 5000 ? 'High' : (tx.amt?.toNumber() || 0) > 2000 ? 'Medium' : 'Low',
    }));

    await this.auditLog.logAction({
      userId,
      operation: 'generate',
      entityName: 'TransactionProfile',
      actionPerformed: 'PROFILE_GENERATED',
      outcome: 'SUCCESS',
    });

    return {
      caseId: dto.caseId,
      filters: dto.filters,
      metrics,
      outliers,
      summaryTable,
      notes: dto.notes,
      visualization,
      detectedAnomalies: detectedAnomalies as DetectedAnomalyDto[],
      transactionTable,
    };
  }

  async getProfile(caseId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.transactionProfile.findFirst({ where: { case_id: caseId } });
    if (!profile) throw new NotFoundException('Transaction profile not found');

    await this.auditLog.logAction({
      operation: 'view',
      entityName: 'TransactionProfile',
      actionPerformed: 'PROFILE_VIEWED',
      outcome: 'SUCCESS',
    });

    return {
      caseId: profile.case_id,
      filters: typeof profile.filters === 'object' && profile.filters !== null ? profile.filters : undefined,
      metrics: typeof profile.metrics === 'object' && profile.metrics !== null ? profile.metrics : {},
      outliers: typeof profile.outliers === 'object' && profile.outliers !== null ? profile.outliers : undefined,
      summaryTable: typeof profile.summary_table === 'object' && profile.summary_table !== null ? profile.summary_table : undefined,
      notes: typeof profile.notes === 'string' ? profile.notes : undefined,
      visualization: typeof profile.visualization === 'string' ? profile.visualization : undefined,
      detectedAnomalies: Array.isArray(profile.detected_anomalies) ? (profile.detected_anomalies as unknown as DetectedAnomalyDto[]) : [],
    };
  }
}
