import { Injectable, Logger } from '@nestjs/common';
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
import { AuthService } from '../auth/auth.service';
import { CacheService } from '../shared/cache.service';

@Injectable()
export class JupyterProxyService {
  private readonly logger = new Logger(JupyterProxyService.name);

  constructor(
    private readonly transactionLakehouseService: TransactionLakehouseService,
    private readonly accountLakehouseService: AccountLakehouseService,
    private readonly alertsLakehouseService: AlertsLakehouseService,
    private readonly benfordsLawLakehouseService: BenfordsLawLakehouseService,
    private readonly conditionLakehouseService: ConditionLakehouseService,
    private readonly authService: AuthService,
    private readonly cacheService: CacheService,
  ) { }

  /**
   * Retrieve the original user's JWT token from cache.
   * This token will be forwarded to Gold Lakehouse for proper authorization.
   *
   * @param userId - The user ID extracted from the service token
   * @returns The user's JWT token
   */
  private async getUserJwt(userId: string): Promise<string> {
    try {
      // Retrieve user's JWT from cache (stored during login)
      const userJwt = await this.cacheService.getUserToken(userId);

      if (!userJwt) {
        this.logger.warn(`No JWT found in cache for user: ${userId}`);
        throw new Error('User session not found');
      }

      // Optionally verify the token hasn't expired
      if (this.authService.isTokenExpired(userJwt)) {
        this.logger.warn(`Expired JWT for user: ${userId}`);
        throw new Error('User session expired');
      }

      return userJwt;
    } catch (error) {
      this.logger.error(`Failed to retrieve user JWT for ${userId}: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async getCounterpartyNetworkData(
    userId: string,
    accountId: string,
    tenantId: string,
    timeRange: string,
  ): Promise<CounterpartyNetworkResponseDto> {
    const userJwt = await this.getUserJwt(userId);
    return await this.transactionLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange, userJwt);
  }

  async getCounterpartyNodeFullData(
    userId: string,
    counterpartyId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<CounterpartyNodeFullDataResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.accountLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity, userJwt);
  }

  async getAlertHistorySummary(
    userId: string,
    endToEndId?: string,
    tenantId?: string,
    entityId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    const userJwt = await this.getUserJwt(userId);
    return await this.alertsLakehouseService.getAlertHistorySummary(endToEndId, tenantId, entityId, granularity, userJwt);
  }

  async getTransactionHistoryData(
    userId: string,
    accountId: string,
    tenantId?: string,
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<TransactionHistoryResponse> {
    const userJwt = await this.getUserJwt(userId);
    this.logger.log(`User token: ${userJwt}`);
    return await this.transactionLakehouseService.getTransactionHistoryByAccountId(
      accountId,
      tenantId ?? 'DEFAULT',
      startDate,
      endDate,
      granularity,
      userJwt,
    );
  }

  async getAlertHistoryTimeline(
    userId: string,
    endToEndId?: string,
    tenantId?: string,
    entityId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<unknown> {
    const userJwt = await this.getUserJwt(userId);
    return await this.alertsLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, entityId, granularity, userJwt);
  }

  async getAlertHistoryAlerts(
    userId: string,
    endToEndId?: string,
    tenantId?: string,
    entityId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    page = 1,
    limit = 20,
  ): Promise<AlertHistoryAlertsResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.alertsLakehouseService.getAlertHistoryAlerts(endToEndId, tenantId, entityId, granularity, page, limit, userJwt);
  }

  async getTransactionNetworkData(
    userId: string,
    accountId: string,
    tenantId: string,
    timeRange: string,
  ): Promise<TransactionNetworkResponseDto> {
    const userJwt = await this.getUserJwt(userId);
    return await this.transactionLakehouseService.getTransactionNetworkData(accountId, tenantId, timeRange, userJwt);
  }

  async getAccountNetworkData(
    userId: string,
    entityId: string,
    tenantId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<AccountNodeFullDataResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.accountLakehouseService.getAccountNodeFullData(entityId, tenantId ?? 'DEFAULT', granularity, userJwt);
  }

  async getBenfordByAccount(
    userId: string,
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
    const userJwt = await this.getUserJwt(userId);
    return await this.benfordsLawLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to, userJwt);
  }

  // ================ CONDITIONS PROXY METHODS ================

  async getConditionsContextByTransaction(
    userId: string,
    transactionId: string,
    tenantId: string,
    asOfDate?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.conditionLakehouseService.getConditionsContextByTransaction(transactionId, tenantId, asOfDate, userJwt);
  }

  async getConditionsSummary(userId: string, accountId: string, tenantId: string, asOfDate?: string): Promise<AccountConditionsSummary> {
    const userJwt = await this.getUserJwt(userId);
    return await this.conditionLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate, userJwt);
  }

  async getConditionsDetails(
    userId: string,
    accountId: string,
    tenantId: string,
    asOfDate?: string,
    showInactive?: boolean,
  ): Promise<ConditionsListByAccountResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.conditionLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive ?? false, userJwt);
  }

  async getConditionsEvaluatedTransactions(
    userId: string,
    accountId: string,
    tenantId: string,
    fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    const userJwt = await this.getUserJwt(userId);
    return await this.conditionLakehouseService.getEvaluatedTransactionsByAccount(accountId, tenantId, fromDate, userJwt);
  }
}
