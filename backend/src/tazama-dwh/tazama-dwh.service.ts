import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaDWHService } from '../../prismaDWH/prismaDWH.service';
import { AuditLogService } from '../audit/auditLog.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto, DetectedAnomalyDto } from './dto/profile-response.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';

@Injectable()
export class TazamaDwhService {
  constructor(
    private readonly prismaDwh: PrismaDWHService,
    private readonly logger: LoggerService,
    private readonly auditLog: AuditLogService,
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
    // Default date range: last 90 days
    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const filter: any = {
      cre_dt_tm: { gte: dateFrom, lte: dateTo },
    };
    // Apply creditorId or debtorId filter if present
    if (dto.filters?.creditorId) {
      filter.destination = dto.filters.creditorId;
    }
    if (dto.filters?.debtorId) {
      filter.source = dto.filters.debtorId;
    }
    // Apply other filters if present
    if (dto.filters?.type) filter.tx_tp = dto.filters.type;
    if (dto.filters?.account) filter.OR = [{ source: dto.filters.account }, { destination: dto.filters.account }];
    if (dto.filters?.role) filter.role = dto.filters.role;
    // Always ignore tenantId for filtering
    const transactions = await this.prismaDwh.transaction.findMany({
      where: filter,
    });
    const transactionTable = transactions.map(this.formatTransactionForTable);
    // Peer baseline: all transactions in last 90 days
    const peerTransactions = await this.prismaDwh.transaction.findMany({
      where: {
        cre_dt_tm: { gte: dateFrom, lte: dateTo },
      },
    });
    const getGeography = (tx: any) => tx.geography || tx.transaction?.geography || tx.transaction?.TxTp || '';
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
    if (this.auditLog) {
      await this.auditLog.logAction({
        userId,
        operation: 'generate',
        entityName: 'TransactionProfile',
        actionPerformed: 'PROFILE_GENERATED',
        outcome: 'SUCCESS',
      });
    }
    return {
      tenantId: dto.tenantId,
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

  async getTransactionsByDebtorId(
    tenantId: string,
    debtorId: string,
  ) {
    try {
      const now = new Date();
      const dateTo = now.toISOString().slice(0, 10);
      const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const where: any = {
        tenant_id: tenantId,
        source: debtorId,
        cre_dt_tm: { gte: dateFrom, lte: dateTo },
      };
      const transactions = await this.prismaDwh.transaction.findMany({
        where,
        orderBy: { cre_dt_tm: 'desc' },
      });
      if (!transactions.length) {
        throw new NotFoundException(`No transactions found for debtorId=${debtorId}`);
      }
      return transactions;
    } catch (err) {
      this.logger.error(`Failed to fetch transactions from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch transactions from DWH');
    }
  }

  async getTransactionsByCreditorId(
    tenantId: string,
    creditorId: string,
  ) {
    try {
      const now = new Date();
      const dateTo = now.toISOString().slice(0, 10);
      const dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const where: any = {
        tenant_id: tenantId,
        destination: creditorId,
        cre_dt_tm: { gte: dateFrom, lte: dateTo },
      };
      const transactions = await this.prismaDwh.transaction.findMany({
        where,
        orderBy: { cre_dt_tm: 'desc' },
      });
      if (!transactions.length) {
        throw new NotFoundException(`No transactions found for creditorId=${creditorId}`);
      }
      return transactions;
    } catch (err) {
      this.logger.error(`Failed to fetch transactions from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch transactions from DWH');
    }
  }
}
