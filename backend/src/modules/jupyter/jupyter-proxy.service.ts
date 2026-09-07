import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
   * Retrieve the JWT to forward to Gold Lakehouse for this call.
   *
   * Falls back to the request's own JWT (`fallbackJwt`, already validated by TazamaAuthGuard)
   * when the cache is missing or expired, instead of failing. Still re-checks `fallbackJwt`'s expiry so "cache and fallback both
   * expired" throws instead of forwarding a dead token. A usable fallback also refreshes the
   * cache on every call via `cacheService.setUserToken`, which only overwrites an older entry
   * so this can't regress a fresher token another tab already cached.
   *
   * @param userId - The user ID extracted from the request
   * @param fallbackJwt - The JWT already validated on the current request, if any
   * @returns The user's JWT token
   */
  private async getUserJwt(userId: string, fallbackJwt?: string): Promise<string> {
    try {
      const userJwt = await this.cacheService.getUserToken(userId);
      const fallbackUsable = Boolean(fallbackJwt) && !this.authService.isTokenExpired(fallbackJwt!);

      if (fallbackUsable) {
        // A fresh JWT on any proxied call refreshes the cache for this user - not only when we
        // need it ourselves below. Safe to do unconditionally: setUserToken only overwrites a
        // strictly older cached entry, so this can't regress a fresher one another tab cached.
        await this.cacheService.setUserToken(userId, fallbackJwt!);
      }

      if (userJwt && !this.authService.isTokenExpired(userJwt)) {
        return userJwt;
      }

      const cacheProblem = userJwt ? 'expired' : 'missing';

      if (fallbackUsable) {
        // Expected, routine occurrence (cache miss/expiry/eviction/Redis outage) - debug level
        // only, so it doesn't add INFO/WARN noise for something that isn't a real failure.
        this.logger.debug(`Cache ${cacheProblem} for user ${userId} - falling back to the request's own validated JWT`);
        return fallbackJwt!;
      }

      // No usable credential anywhere - this is a genuine failure, worth surfacing above debug.
      this.logger.warn(`No usable JWT for user ${userId} (cache ${cacheProblem}, no valid request fallback)`);
      throw new UnauthorizedException('User session not found or expired');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Failed to retrieve user JWT for ${userId}: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async getCounterpartyNetworkData(
    userId: string,
    accountId: string,
    tenantId: string,
    timeRange: string,
    fallbackJwt?: string,
  ): Promise<CounterpartyNetworkResponseDto> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.transactionLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange, userJwt);
  }

  async getCounterpartyNodeFullData(
    userId: string,
    counterpartyId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    fallbackJwt?: string,
  ): Promise<CounterpartyNodeFullDataResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.accountLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity, userJwt);
  }

  async getAlertHistorySummary(
    userId: string,
    tenantId: string,
    entityId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    fallbackJwt?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.alertsLakehouseService.getAlertHistorySummary(tenantId, entityId, granularity, userJwt);
  }

  async getTransactionHistoryData(
    userId: string,
    accountId: string,
    tenantId?: string,
    startDate?: string,
    endDate?: string,
    granularity?: string,
    fallbackJwt?: string,
  ): Promise<TransactionHistoryResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
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
    tenantId: string,
    entityId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    fallbackJwt?: string,
  ): Promise<unknown> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.alertsLakehouseService.getAlertHistoryTimeline(tenantId, entityId, granularity, userJwt);
  }

  async getAlertHistoryAlerts(
    userId: string,
    tenantId: string,
    entityId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    page: number,
    limit: number,
    fallbackJwt?: string,
  ): Promise<AlertHistoryAlertsResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.alertsLakehouseService.getAlertHistoryAlerts(tenantId, entityId, granularity, page, limit, userJwt);
  }

  async getTransactionNetworkData(
    userId: string,
    accountId: string,
    tenantId: string,
    timeRange: string,
    startDate?: string,
    endDate?: string,
    fallbackJwt?: string,
  ): Promise<TransactionNetworkResponseDto> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.transactionLakehouseService.getTransactionNetworkData(accountId, tenantId, timeRange, startDate, endDate, userJwt);
  }

  async getAccountNetworkData(
    userId: string,
    entityId: string,
    tenantId?: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    fallbackJwt?: string,
  ): Promise<AccountNodeFullDataResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.accountLakehouseService.getAccountNodeFullData(entityId, tenantId ?? 'DEFAULT', granularity, userJwt);
  }

  async getBenfordByAccount(
    userId: string,
    accountId: string,
    tenantId: string,
    from: string,
    to: string,
    fallbackJwt?: string,
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
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.benfordsLawLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to, userJwt);
  }

  // ================ CONDITIONS PROXY METHODS ================

  async getConditionsContextByTransaction(
    userId: string,
    transactionId: string,
    tenantId: string,
    asOfDate?: string,
    fallbackJwt?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.conditionLakehouseService.getConditionsContextByTransaction(transactionId, tenantId, asOfDate, userJwt);
  }

  async getConditionsSummary(
    userId: string,
    accountId: string,
    tenantId: string,
    asOfDate?: string,
    fallbackJwt?: string,
  ): Promise<AccountConditionsSummary> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.conditionLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate, userJwt);
  }

  async getConditionsDetails(
    userId: string,
    accountId: string,
    tenantId: string,
    asOfDate?: string,
    showInactive?: boolean,
    fallbackJwt?: string,
  ): Promise<ConditionsListByAccountResponse> {
    const userJwt = await this.getUserJwt(userId, fallbackJwt);
    return await this.conditionLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive ?? false, userJwt);
  }
}
