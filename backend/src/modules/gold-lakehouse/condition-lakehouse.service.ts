import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import {
  ConditionsByEntityResponse,
  ConditionsContextByTransactionResponse,
  EvaluatedTransactionsResponse,
} from './types/gold-lakehouse-responses.types';
import { AccountConditionsSummary, ConditionsListByAccountResponse } from './types/IAccountConditions.types';

@Injectable()
export class ConditionLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getConditionsSummaryByAccount(
    accountId: string,
    tenantId = 'DEFAULT',
    fromDate?: string,
    asOfDate?: string,
  ): Promise<AccountConditionsSummary> {
    try {
      this.logger.log(`Fetching conditions summary for account: ${accountId}`);

      const params: any[] = [accountId];
      let asOfDateFilter = '';
      if (asOfDate) {
        asOfDateFilter = `
          AND condition_inception_ts <= $${params.length + 1}
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $${params.length + 1})
        `;
        params.push(asOfDate);
      }

      let tenantFilter = '';
      if (tenantId && tenantId !== 'DEFAULT') {
        tenantFilter = `AND tenant_id = $${params.length + 1}`;
        params.push(tenantId);
      }

      const sql = `
      SELECT 
        COUNT(*) as total_conditions,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_conditions,
        SUM(CASE WHEN is_expired = 1 THEN 1 ELSE 0 END) as expired_conditions,
        SUM(CASE WHEN is_active = 0 AND is_expired = 0 THEN 1 ELSE 0 END) as future_conditions
      FROM conditions
      WHERE account_id = $1
        ${tenantFilter}
        ${asOfDateFilter}
      `;

      const response = await this.runSqlQuery(sql, 1, params);
      const summary = response.data?.[0] ?? {};

      // const conditionsSql = `
      // SELECT
      //   condition_id,
      //   condition_reason,
      //   condition_type,
      //   perspective,
      //   condition_inception_ts,
      //   condition_expiry_ts,
      //   is_active,
      //   is_expired,
      //   created_by_user,
      //   account_scheme,
      //   account_agent_mmb_id
      // FROM conditions
      // WHERE account_id = 'ACC-ce6e83a6'
      // AND tenant_id = 'DEFAULT'
      // LIMIT 100
      // `;

      const conditionsParams: any[] = [accountId];
      let conditionsTenantFilter = '';
      let conditionsAsOfDateFilter = '';

      if (tenantId && tenantId !== 'DEFAULT') {
        conditionsTenantFilter = `AND tenant_id = $${conditionsParams.length + 1}`;
        conditionsParams.push(tenantId);
      }

      if (asOfDate) {
        conditionsAsOfDateFilter = `
          AND condition_inception_ts <= $${conditionsParams.length + 1}
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $${conditionsParams.length + 1})
        `;
        conditionsParams.push(asOfDate);
      }

      const conditionsSql = `
      SELECT 
        condition_id,
        condition_reason,
        condition_type,
        perspective,
        condition_inception_ts,
        condition_expiry_ts,
        is_active,
        is_expired,
        created_by_user,
        account_scheme,
        account_agent_mmb_id
      FROM conditions_timeline
      WHERE account_id = $1
        ${conditionsTenantFilter}
        ${conditionsAsOfDateFilter}
      LIMIT 100
      `;

      const conditionsResponse = await this.runSqlQuery(conditionsSql, 100, conditionsParams);
      const conditions = (conditionsResponse.data ?? []).map((cond) => ({
        conditionId: cond.condition_id,
        type: cond.condition_type ?? 'no data found',
        perspective: cond.perspective ?? 'no data found',
        reason: cond.condition_reason ?? 'no data found',
        status: cond.is_active === 1 ? 'active' : cond.is_expired === 1 ? 'expired' : 'future',
        inceptionDate: cond.condition_inception_ts,
        expiryDate: cond.condition_expiry_ts,
        createdBy: cond.created_by_user ?? 'no data found',
      }));

      return {
        accountId,
        accountScheme: conditionsResponse.data?.[0]?.account_scheme ?? 'no data found',
        fspId: conditionsResponse.data?.[0]?.account_agent_mmb_id ?? 'no data found',
        totalConditions: summary.total_conditions ?? 0,
        activeConditions: summary.active_conditions ?? 0,
        expiredConditions: summary.expired_conditions ?? 0,
        futureConditions: summary.future_conditions ?? 0,
        conditions,
        metadata: {
          asOfDate: asOfDate ?? 'current',
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching conditions summary by account: ${message}`, errorStack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(`Failed to fetch conditions summary: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsListByAccount(
    id: string,
    tenantId = 'DEFAULT',
    asOfDate?: string,
    showInactive = false,
  ): Promise<ConditionsListByAccountResponse> {
    try {
      this.logger.log(`Fetching all conditions for ID: ${id}`);

      const params: any[] = [id];
      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= $${params.length + 1}
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $${params.length + 1})
        `;
        params.push(asOfDate);
      }

      let tenantFilter = '';
      if (tenantId && tenantId !== 'DEFAULT') {
        tenantFilter = `AND ct.tenant_id = $${params.length + 1}`;
        params.push(tenantId);
      }

      const sql = `
      SELECT
        ct.condition_id,
        ct.condition_reason,
        ct.condition_type,
        ct.perspective,
        ct.condition_inception_ts,
        ct.condition_expiry_ts,
        ct.condition_created_ts,
        ct.is_active,
        ct.is_expired,
        ct.account_id,
        ct.tenant_id,
        ct.account_scheme,
        ct.event_types_csv,
        ct.created_by_user
      FROM conditions ct
      WHERE ct.account_id = $1
        ${tenantFilter}
        ${dateFilter}
      ORDER BY ct.condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500, params);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} conditions for ID ${id}`);

      const formattedConditions = rows.map((row) => ({
        conditionId: row.condition_id,
        pk: 'no mapping found',
        tenantId: row.tenant_id ?? tenantId,
        bucketGranularity: 'no data found',
        bucketStart: 'no data found',
        accountId: row.account_id,
        accountScheme: row.account_scheme ?? 'no data found',
        type: row.condition_type ?? 'no data found',
        perspective: row.perspective ?? 'no data found',
        reason: row.condition_reason ?? 'no data found',
        eventTypes: row.event_types_csv ?? 'no data found',
        inceptionDate: row.condition_inception_ts,
        expiryDate: row.condition_expiry_ts,
        createdDate: row.condition_created_ts,
        isActive: row.is_active === 1,
        isExpired: row.is_expired === 1,
        createdBy: row.created_by_user ?? 'no data found',
      }));

      return {
        accountId: id,
        totalConditions: rows.length,
        conditions: formattedConditions,
        metadata: {
          activeCount: rows.filter((r) => r.is_active === 1).length,
          expiredCount: rows.filter((r) => r.is_expired === 1).length,
          futureCount: rows.filter((r) => r.is_active === 0 && r.is_expired === 0).length,
          asOfDate: asOfDate ?? 'current',
          showInactive,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions list by account', errorStack);
      throw new HttpException('Failed to fetch conditions list', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvaluatedTransactionsByAccount(
    accountId: string,
    tenantId = 'DEFAULT',
    fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    try {
      this.logger.log(`Fetching evaluated transactions for account: ${accountId}`);
      const params: any[] = [accountId, tenantId];
      const dateFilter = fromDate ? `AND ct.cond_inception_ts >= $${params.length + 1}` : '';
      if (fromDate) {
        params.push(fromDate);
      }

      const sql = `
      SELECT DISTINCT
        td.transaction_id as tx_transaction_id,
        td.tx_event_ts,
        td.tx_type,
        td.interbank_settlement_amount as tx_amount,
        td.interbank_settlement_currency as tx_ccy,
        ct.cond_condition_id,
        ct.cond_type,
        ct.cond_reason,
        ct.cond_inception_ts,
        ct.cond_expiry_ts,
        ct.cond_account_id,
        CASE 
          WHEN td.debtor_account_id = ct.cond_account_id THEN 'debtor'
          WHEN td.creditor_account_id = ct.cond_account_id THEN 'creditor'
          ELSE 'unknown'
        END as account_role
      FROM conditions_timeline ct
      INNER JOIN transaction_detail td ON (
        (td.debtor_account_id = ct.cond_account_id OR td.creditor_account_id = ct.cond_account_id)
        AND td.tx_event_ts >= ct.cond_inception_ts
        AND (ct.cond_expiry_ts IS NULL OR td.tx_event_ts <= ct.cond_expiry_ts)
        AND td.tenant_id = ct.cond_tenant_id
      )
      WHERE ct.cond_account_id = $1
        AND ct.cond_tenant_id = $2
        ${dateFilter}
      ORDER BY td.tx_event_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500, params);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} transactions for account ${accountId}`);

      if (rows.length === 0) {
        return {
          transactions: [],
          metadata: {
            accountId,
            totalRecords: 0,
            status: 'DATA_NOT_FOUND',
            joinMethod: 'Temporal (Time-based)',
            message: 'No transactions found overlapping with condition windows (Temporal Join returned 0 results)',
            queryTimestamp: new Date().toISOString(),
          },
        };
      }

      return {
        transactions: rows.map((r) => ({
          transactionId: r.tx_transaction_id ?? 'NOT_MAPPED',
          date: r.tx_event_ts ?? 'NOT_FOUND',
          type: r.tx_type ?? 'UNKNOWN',
          amount: r.tx_amount ?? 0,
          currency: r.tx_ccy ?? 'N/A',
          outcome: r.cond_type === 'overridable-block' ? 'BLOCKED_OVERRIDABLE' : 'BLOCKED',
          conditionId: r.cond_condition_id ?? 'NOT_FOUND',
          conditionType: r.cond_type ?? 'UNKNOWN',
          reason: r.cond_reason ?? 'NO_REASON_PROVIDED',
          conditionPeriod: {
            start: r.cond_inception_ts ?? 'NOT_FOUND',
            end: r.cond_expiry_ts ?? 'NOT_FOUND',
          },
          accountRole: r.account_role ?? 'UNMAPPED',
          accountId: r.cond_account_id ?? accountId,
        })),
        metadata: {
          accountId,
          totalRecords: rows.length,
          status: 'SUCCESS',
          joinMethod: 'Temporal (Time-based)',
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching evaluated transactions by account', errorStack);
      throw new HttpException('Failed to fetch evaluated transactions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Transaction ID based methods

  async getConditionsContextByTransaction(
    transactionId: string,
    tenantId = 'DEFAULT',
    asOfDate?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    try {
      const txSql =
        'SELECT transaction_id, end_to_end_id, tx_event_ts, tx_event_date, tx_type, interbank_settlement_amount, interbank_settlement_currency, debtor_id, debtor_name, debtor_account_id, creditor_id, creditor_name, creditor_account_id FROM transaction_detail WHERE end_to_end_id = $1 AND tenant_id = $2 LIMIT 1;';

      const txResponse = await this.runSqlQuery(txSql, 1, [transactionId, tenantId]);
      const tx = txResponse.data?.[0];

      if (!tx) {
        throw new HttpException(`Transaction ${transactionId} not found`, HttpStatus.NOT_FOUND);
      }

      const filterDate = asOfDate ?? tx.tx_event_ts;

      const displayId = `TXN-${tx.tx_event_date?.replace(/-/gv, '')}${transactionId}`;

      const debtorAccounts = await this.getEntityAccountsWithConditionCounts(tx.debtor_id, tx.debtor_account_id, tenantId, filterDate);

      const creditorAccounts = await this.getEntityAccountsWithConditionCounts(
        tx.creditor_id,
        tx.creditor_account_id,
        tenantId,
        filterDate,
      );

      return {
        transaction: {
          transactionId: tx.transaction_id,
          displayId,
          endToEndId: tx.end_to_end_id ?? 'no data found',
          timestamp: tx.tx_event_ts,
          type: tx.tx_type ?? 'no data found',
          amount: tx.interbank_settlement_amount,
          currency: tx.interbank_settlement_currency ?? 'no data found',
        },
        debtor: {
          entityId: tx.debtor_id ?? 'no data found',
          entityName: tx.debtor_name ?? 'no data found',
          primaryAccountId: tx.debtor_account_id ?? 'no data found',
          accounts: debtorAccounts,
        },
        creditor: {
          entityId: tx.creditor_id ?? 'no data found',
          entityName: tx.creditor_name ?? 'no data found',
          primaryAccountId: tx.creditor_account_id ?? 'no data found',
          accounts: creditorAccounts,
        },
        metadata: {
          asOfDate: filterDate,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching conditions context by transaction: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch conditions context', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async getEntityAccountsWithConditionCounts(
    entityId: string,
    primaryAccountId: string,
    tenantId: string,
    asOfDate: string,
  ): Promise<
    Array<{
      accountId: string;
      accountNumber: string;
      accountType: string;
      isTransactionAccount: boolean;
      activeConditionsCount: number;
      expiredConditionsCount: number;
      futureConditionsCount: number;
    }>
  > {
    try {
      const accountIdsSet = new Set<string>();

      if (primaryAccountId && primaryAccountId !== 'no data found') {
        accountIdsSet.add(primaryAccountId);
      }

      if (entityId && entityId !== 'no data found') {
        const accountsSql = `
        SELECT DISTINCT destination as account_id
        FROM account_holder
        WHERE source = $1
          AND tenant_id = $2
        `;

        const accountsResponse = await this.runSqlQuery(accountsSql, 100, [entityId, tenantId]);
        accountsResponse.data?.forEach((r) => {
          if (r.account_id) {
            accountIdsSet.add(r.account_id);
          }
        });
      }

      const accountIds = Array.from(accountIdsSet);

      this.logger.debug(
        `Found ${accountIds.length} unique accounts for entity ${entityId}: ` +
          `${primaryAccountId ? '1 transaction account' : 'no transaction account'} + ` +
          `${accountIds.length - (primaryAccountId ? 1 : 0)} from account_holder`,
      );

      if (accountIds.length === 0) {
        this.logger.warn(`No accounts found for entity ${entityId}`);
        return [];
      }

      const accountsWithCounts = await Promise.all(
        accountIds.map(async (accountId) => {
          const conditionsSql = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE 
              WHEN condition_inception_ts <= $1 
              AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $1)
              AND is_active = 1 
              THEN 1 ELSE 0 
            END) as active,
            SUM(CASE 
              WHEN condition_expiry_ts < $1 
              AND is_expired = 1 
              THEN 1 ELSE 0 
            END) as expired,
            SUM(CASE 
              WHEN condition_inception_ts > $1 
              AND is_active = 0 
              AND is_expired = 0 
              THEN 1 ELSE 0 
            END) as future
          FROM conditions
          WHERE account_id = $2
            AND tenant_id = $3
          `;

          const countsResponse = await this.runSqlQuery(conditionsSql, 1, [asOfDate, accountId, tenantId]);
          const counts = countsResponse.data?.[0] ?? {};

          const accountNumber = accountId.slice(-12);

          return {
            accountId,
            accountNumber: `****${accountNumber}`,
            accountType: 'no mapping found',
            isTransactionAccount: accountId === primaryAccountId,
            activeConditionsCount: Number(counts.active ?? 0),
            expiredConditionsCount: Number(counts.expired ?? 0),
            futureConditionsCount: Number(counts.future ?? 0),
          };
        }),
      );

      return accountsWithCounts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching entity accounts with condition counts: ${errorMessage}`);
      return [];
    }
  }

  async getConditionsByEntity(
    entityId: string,
    tenantId = 'DEFAULT',
    asOfDate?: string,
    showInactive = false,
  ): Promise<ConditionsByEntityResponse> {
    try {
      this.logger.log(`Fetching conditions for entity: ${entityId}`);

      const accountsSql = `
      SELECT DISTINCT destination as account_id
      FROM account_holder
      WHERE source = $1
        AND tenant_id = $2
      `;

      const accountsResponse = await this.runSqlQuery(accountsSql, 100, [entityId, tenantId]);
      const accountIds = accountsResponse.data?.map((r) => r.account_id).filter(Boolean) ?? [];

      if (accountIds.length === 0) {
        return {
          entityId,
          accounts: [],
          conditions: [],
          metadata: {
            entityId,
            accountCount: 0,
            totalConditions: 0,
            asOfDate: asOfDate ?? 'current',
            showInactive,
            message: 'No accounts found for this entity',
            queryTimestamp: new Date().toISOString(),
          },
        };
      }

      const params: any[] = [tenantId, entityId];
      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= $${params.length + 1}
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $${params.length + 1})
        `;
        params.push(asOfDate);
      }

      // Build parameterized IN clause
      const accountPlaceholders = accountIds.map((_, idx) => `$${params.length + idx + 1}`).join(',');
      params.push(...accountIds);

      const conditionsSql = `
      SELECT
        condition_id,
        condition_reason,
        condition_type,
        condition_inception_ts,
        condition_expiry_ts,
        is_active,
        is_expired,
        account_id,
        entity_id,
        condition_created_ts,
        created_by_user
      FROM conditions
      WHERE ((account_id IN (${accountPlaceholders}) AND identity_type = 'ACCOUNT')
             OR (entity_id = $2 AND identity_type = 'ENTITY'))
        AND tenant_id = $1
        ${dateFilter}
      ORDER BY condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(conditionsSql, 500, params);
      const rows = response.data ?? [];

      return {
        entityId,
        accounts: accountIds,
        conditions: rows.map((r) => ({
          conditionId: r.condition_id,
          title: r.condition_reason ?? 'no data found',
          type: r.condition_type ?? 'no data found',
          createdBy: r.created_by_user ?? 'no data found',
          startDate: r.condition_inception_ts,
          endDate: r.condition_expiry_ts ?? 'no data found',
          status: r.is_active === 1 ? 'ACTIVE' : r.is_expired === 1 ? 'EXPIRED' : 'FUTURE',
          accountId: r.account_id ?? r.entity_id,
          notes: r.condition_reason ?? 'no data found',
        })),
        metadata: {
          entityId,
          accountCount: accountIds.length,
          totalConditions: rows.length,
          asOfDate: asOfDate ?? 'current',
          showInactive,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions by entity', errorStack);
      throw new HttpException('Failed to fetch conditions by entity', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
