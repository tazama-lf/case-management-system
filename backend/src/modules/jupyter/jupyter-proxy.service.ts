import { Injectable } from '@nestjs/common';
import { GoldLakehouseService } from '../gold-lakehouse/gold-lakehouse.service';
import { CounterpartyNetworkResponseDto, TransactionNetworkResponseDto } from '../gold-lakehouse/dto/network-analysis.dto';
import { Alerts, Edge, Node } from '../gold-lakehouse/types/gold-lakehouse.types';
import {
  AccountNodeFullDataResponse,
  CounterpartyNodeFullDataResponse,
  EvaluatedTransactionsResponse,
} from '../gold-lakehouse/types/gold-lakehouse-responses.types';
import { Account } from '@tazama-lf/frms-coe-lib/lib/interfaces/event-flow/EntityConditionEdge';

@Injectable()
export class JupyterProxyService {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) {}

  async getCounterpartyNetworkData(accountId: string, tenantId: string, timeRange: string): Promise<CounterpartyNetworkResponseDto> {
    return await this.goldLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange);
  }

  async getCounterpartyNodeFullData(
    counterpartyId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<CounterpartyNodeFullDataResponse> {
    return await this.goldLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity);
  }

  async getAlertHistorySummary(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    return await this.goldLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange ?? 'all');
  }

  async getTransactionHistoryData(
    entityId: string,
    tenantId?: string,
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<unknown> {
    return await this.goldLakehouseService.getTransactionHistoryData(entityId, tenantId ?? 'DEFAULT', startDate, endDate, granularity);
  }

  async getAlertHistoryTimeline(endToEndId?: string, tenantId?: string, dateRange?: string, granularity = 'day'): Promise<unknown> {
    return await this.goldLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  async getAlertHistoryAlerts(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    alerts: Alerts[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    return await this.goldLakehouseService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange ?? 'all', page, limit);
  }

  async getTransactionNetworkData(accountId: string, tenantId?: string, timeRange?: string): Promise<TransactionNetworkResponseDto> {
    return await this.goldLakehouseService.getTransactionNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  async getAccountNetworkData(
    accountId: string,
    tenantId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<AccountNodeFullDataResponse> {
    return await this.goldLakehouseService.getAccountNodeFullData(accountId, tenantId ?? 'DEFAULT', granularity);
  }

  async getBenfordByAccount(
    accountId: string,
    tenantId: string,
    from: string,
    to: string,
  ): Promise<{
    expected: Record<number, number>;
    actual: Record<number, number>;
    sampleSize: number;
    meta: {
      accountId: string;
      tenantId: string;
      fromDate: string;
      toDate: string;
    };
  }> {
    return await this.goldLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to);
  }

  // ================ CONDITIONS PROXY METHODS ================

  async getConditionsContextByTransaction(transactionId: number, tenantId = 'DEFAULT', asOfDate?: string) {
    return await this.goldLakehouseService.getConditionsContextByTransaction(transactionId, tenantId, asOfDate);
  }

  async getConditionsSummary(accountId: string, tenantId = 'DEFAULT', asOfDate?: string) {
    return await this.goldLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate);
  }

  async getConditionsDetails(accountId: string, tenantId = 'DEFAULT', asOfDate?: string, showInactive?: boolean) {
    return await this.goldLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive ?? false);
  }

  async getConditionsEvaluatedTransactions(
    accountId: string,
    tenantId = 'DEFAULT',
    fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    return await this.goldLakehouseService.getEvaluatedTransactionsByAccount(accountId, tenantId, fromDate);
  }
}
