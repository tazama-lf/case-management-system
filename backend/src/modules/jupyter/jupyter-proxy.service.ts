import { Injectable } from '@nestjs/common';
import { TransactionLakehouseService } from '../gold-lakehouse/transaction-lakehouse.service';
import { AccountLakehouseService } from '../gold-lakehouse/account-lakehouse.service';
import { AlertsLakehouseService } from '../gold-lakehouse/alerts-lakehouse.service';
import { BenfordsLawLakehouseService } from '../gold-lakehouse/benfordsLaw-lakehouse.service';
import { ConditionLakehouseService } from '../gold-lakehouse/condition-lakehouse.service';
import { CounterpartyNetworkResponseDto, TransactionNetworkResponseDto } from '../gold-lakehouse/dto/network-analysis.dto';
import {
  AccountNodeFullDataResponse,
  ConditionsContextByTransactionResponse,
  CounterpartyNodeFullDataResponse,
  EvaluatedTransactionsResponse,
} from '../gold-lakehouse/types/gold-lakehouse-responses.types';
import { AccountConditionsSummary, ConditionsListByAccountResponse } from '../gold-lakehouse/types/IAccountConditions.types';
import { AlertHistoryAlertsResponse } from '../gold-lakehouse/types/IAlertHistory.types';
import { TransactionHistoryResponse } from '../gold-lakehouse/types/transaction-history-response.types';

@Injectable()
export class JupyterProxyService {
  constructor(
    private readonly transactionLakehouseService: TransactionLakehouseService,
    private readonly accountLakehouseService: AccountLakehouseService,
    private readonly alertsLakehouseService: AlertsLakehouseService,
    private readonly benfordsLawLakehouseService: BenfordsLawLakehouseService,
    private readonly conditionLakehouseService: ConditionLakehouseService,
  ) {}

  async getCounterpartyNetworkData(accountId: string, tenantId: string, timeRange: string): Promise<CounterpartyNetworkResponseDto> {
    return await this.transactionLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange);
  }

  async getCounterpartyNodeFullData(
    counterpartyId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<CounterpartyNodeFullDataResponse> {
    return await this.accountLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity);
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
    return await this.alertsLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange ?? 'all');
  }

  async getTransactionHistoryData(
    accountId: string,
    tenantId?: string,
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<TransactionHistoryResponse> {
    return await this.transactionLakehouseService.getTransactionHistoryByAccountId(
      accountId,
      tenantId ?? 'DEFAULT',
      startDate,
      endDate,
      granularity,
    );
  }

  async getAlertHistoryTimeline(endToEndId?: string, tenantId?: string, dateRange?: string, granularity = 'day'): Promise<unknown> {
    return await this.alertsLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  async getAlertHistoryAlerts(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
    page = 1,
    limit = 20,
  ): Promise<AlertHistoryAlertsResponse> {
    return await this.alertsLakehouseService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange ?? 'all', page, limit);
  }

  async getTransactionNetworkData(accountId: string, tenantId?: string, timeRange?: string): Promise<TransactionNetworkResponseDto> {
    return await this.transactionLakehouseService.getTransactionNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  async getAccountNetworkData(
    accountId: string,
    tenantId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<AccountNodeFullDataResponse> {
    return await this.accountLakehouseService.getAccountNodeFullData(accountId, tenantId ?? 'DEFAULT', granularity);
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
    return await this.benfordsLawLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to);
  }

  // ================ CONDITIONS PROXY METHODS ================

  async getConditionsContextByTransaction(
    transactionId: string,
    tenantId = 'DEFAULT',
    asOfDate?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    return await this.conditionLakehouseService.getConditionsContextByTransaction(transactionId, tenantId, asOfDate);
  }

  async getConditionsSummary(accountId: string, tenantId = 'DEFAULT', asOfDate?: string): Promise<AccountConditionsSummary> {
    return await this.conditionLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate);
  }

  async getConditionsDetails(
    accountId: string,
    tenantId = 'DEFAULT',
    asOfDate?: string,
    showInactive?: boolean,
  ): Promise<ConditionsListByAccountResponse> {
    return await this.conditionLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive ?? false);
  }

  async getConditionsEvaluatedTransactions(
    accountId: string,
    tenantId = 'DEFAULT',
    fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    return await this.conditionLakehouseService.getEvaluatedTransactionsByAccount(accountId, tenantId, fromDate);
  }
}
