import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import {
  ConditionsByEntityResponse,
  ConditionsContextByTransactionResponse,
  EvaluatedTransactionsResponse,
  FutureConditionsResponse,
} from './types/gold-lakehouse-responses.types';
import { AccountConditionsSummary, ConditionsListByAccountResponse } from './types/IAccountConditions.types';
import { ConditionsTableDataResponse } from './types/IConditionsTableData.types';

@Injectable()
export class ConditionLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getConditionsSummary(identifier: string, tenantId?: string, fromDate?: string): Promise<unknown> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId ?? 'DEFAULT');
      if (accounts.length === 0) {
        return {
          activeConditions: 0,
          blockedTransactions: 0,
          overriddenTransactions: 0,
          futureConditions: 0,
          metadata: {
            queriedBy: identifier,
            accountCount: 0,
            accounts: [],
          },
        };
      }

      const tenantFilter = tenantId ? `AND cond_tenant_id = '${tenantId}'` : '';
      const dateFilter = fromDate ? `AND bucket_start >= '${fromDate}'` : '';
      const accountFilter = accounts.map((a) => `'${a}'`).join(',');

      const sql = `
      SELECT
        COUNT(DISTINCT cond_condition_id)
        FILTER (WHERE cond_is_active = 1)  AS active_conditions,
        COUNT(*) FILTER (WHERE tx_block_override_status = 'BLOCKED') AS blocked_transactions,
        COUNT(*) FILTER (WHERE tx_block_override_status = 'OVERRIDDEN') AS overridden_transactions,
        COUNT(DISTINCT cond_condition_id)
          FILTER (WHERE cond_is_active = 0 AND cond_is_expired = 0) AS future_conditions
      FROM conditions_timeline
      WHERE cond_account_id IN (${accountFilter})
        ${tenantFilter}
        ${dateFilter}
    `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response.data?.[0] ?? {};

      // Determine if this was an entity-level query (not transaction_id or account_id)
      const isNumeric = /^\d+$/v.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/iv.test(identifier);
      const isEntityLevel = !isNumeric && !isUuid && accounts.length > 1;

      return {
        activeConditions: Number(row.active_conditions ?? 0),
        blockedTransactions: Number(row.blocked_transactions ?? 0),
        overriddenTransactions: Number(row.overridden_transactions ?? 0),
        futureConditions: Number(row.future_conditions ?? 0),
        metadata: {
          queriedBy: identifier,
          accountCount: accounts.length,
          accounts: isEntityLevel ? accounts : undefined,
          isEntityLevel,
        },
      };
    } catch (error: unknown) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions summary', errorStack);
      throw new HttpException('Failed to fetch conditions summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsList(identifier: string, tenantId?: string): Promise<unknown[]> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId ?? 'DEFAULT');
      if (accounts.length === 0) {
        return [];
      }

      const filters: any = {
        account_id: accounts.length === 1 ? accounts[0] : accounts,
      };

      if (tenantId) {
        filters.tenant_id = tenantId;
      }

      const response = await this.query({
        table_name: 'conditions',
        filters,
      });

      const rows = response.data;

      return rows.map((r) => {
        const row = this.stripHudiMetadata(r);

        let status: 'ACTIVE' | 'EXPIRED' | 'FUTURE' = 'ACTIVE';
        if (row.is_expired === 1) status = 'EXPIRED';
        else if (row.is_active === 0) status = 'FUTURE';

        return {
          conditionId: row.condition_id,
          conditionType: row.condition_type,
          conditionReason: row.condition_reason,
          createdBy: row.created_by_user,
          startDate: row.condition_inception_ts,
          endDate: row.condition_expiry_ts,
          status,
          notes: row.condition_reason,
        };
      });
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions list', errorStack);
      throw new HttpException('Failed to fetch conditions list', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getActiveConditions(identifier: string, tenantId = 'DEFAULT', fromDate?: string): Promise<unknown> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId);
      if (accounts.length === 0) {
        return {
          conditions: [],
          metadata: {
            queriedBy: identifier,
            accountCount: 0,
            accounts: [],
          },
        };
      }
      const dateFilter = fromDate ? `AND ct.bucket_start >= '${fromDate}'` : '';
      const accountFilter = accounts.map((a) => `'${a}'`).join(',');

      // Query with LEFT JOIN to transaction_detail to show transactions during active condition
      const sql = `
      SELECT
        ct.cond_condition_id as condition_id,
        ct.cond_reason as condition_reason,
        ct.cond_type as condition_type,
        ct.cond_inception_ts as condition_inception_ts,
        ct.cond_expiry_ts as condition_expiry_ts,
        ct.cond_account_id as account_id,
        ct.cond_created_ts as created_ts,
        td.transaction_id,
        td.end_to_end_id,
        td.tx_type,
        td.tx_event_ts,
        td.interbank_settlement_amount,
        td.interbank_settlement_currency,
        td.debtor_id,
        td.creditor_id,
        CASE 
          WHEN td.debtor_account_id = ct.cond_account_id THEN 'debtor'
          WHEN td.creditor_account_id = ct.cond_account_id THEN 'creditor'
          ELSE NULL
        END as account_role
      FROM conditions_timeline ct
      LEFT JOIN transaction_detail td ON (
        (td.debtor_account_id = ct.cond_account_id OR td.creditor_account_id = ct.cond_account_id)
        AND td.tx_event_ts >= ct.cond_inception_ts
        AND (ct.cond_expiry_ts IS NULL OR td.tx_event_ts <= ct.cond_expiry_ts)
        AND td.tenant_id = ct.cond_tenant_id
      )
      WHERE ct.cond_account_id IN (${accountFilter})
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_is_active = 1
        ${dateFilter}
      ORDER BY ct.cond_inception_ts DESC, td.tx_event_ts DESC
      LIMIT 1000
    `;

      this.logger.log(`Fetching active conditions with transactions for accounts: ${accountFilter}`);
      const response = await this.runSqlQuery(sql, 1000);
      const rows = response.data ?? [];

      // Group by condition_id and aggregate transactions
      const conditionsMap = new Map();
      rows.forEach((r) => {
        if (!conditionsMap.has(r.condition_id)) {
          conditionsMap.set(r.condition_id, {
            conditionId: r.condition_id,
            title: r.condition_reason,
            type: r.condition_type,
            createdBy: 'no mapping found',
            startDate: r.condition_inception_ts,
            endDate: r.condition_expiry_ts ?? 'no data found',
            notes: r.condition_reason,
            action: r.condition_type === 'overridable-block' ? 'OVERRIDE' : 'BLOCK',
            accountId: r.account_id,
            transactions: [],
          });
        }
        // Add transaction if it exists
        if (r.transaction_id) {
          conditionsMap.get(r.condition_id).transactions.push({
            transactionId: r.transaction_id,
            endToEndId: r.end_to_end_id,
            type: r.tx_type,
            date: r.tx_event_ts,
            amount: r.interbank_settlement_amount,
            currency: r.interbank_settlement_currency,
            debtorId: r.debtor_id,
            creditorId: r.creditor_id,
            accountRole: r.account_role,
          });
        }
      });

      const conditions = Array.from(conditionsMap.values());

      // Determine if this was an entity-level query
      const isNumeric = /^\d+$/v.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/iv.test(identifier);
      const isEntityLevel = !isNumeric && !isUuid && accounts.length > 1;

      this.logger.log(`Found ${conditions.length} active conditions with ${rows.filter((r) => r.transaction_id).length} transaction links`);

      return {
        conditions,
        metadata: {
          queriedBy: identifier,
          accountCount: accounts.length,
          accounts: isEntityLevel ? accounts : undefined,
          isEntityLevel,
          totalTransactionLinks: rows.filter((r) => r.transaction_id).length,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching active conditions', errorStack);
      throw new HttpException('Failed to fetch active conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExpiredConditions(identifier: string, tenantId = 'DEFAULT'): Promise<unknown> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId);
      if (accounts.length === 0) {
        return {
          conditions: [],
          metadata: {
            queriedBy: identifier,
            accountCount: 0,
            accounts: [],
          },
        };
      }
      const accountFilter = accounts.map((a) => `'${a}'`).join(',');

      const sql = `
      SELECT
        ct.cond_condition_id as condition_id,
        ct.cond_reason as condition_reason,
        ct.cond_inception_ts as condition_inception_ts,
        ct.cond_expiry_ts as condition_expiry_ts,
        ct.cond_type as condition_type,
        ct.cond_account_id as account_id,
        td.transaction_id,
        td.end_to_end_id,
        td.tx_type,
        td.tx_event_ts,
        td.interbank_settlement_amount,
        td.interbank_settlement_currency,
        td.debtor_id,
        td.creditor_id,
        CASE 
          WHEN td.debtor_account_id = ct.cond_account_id THEN 'debtor'
          WHEN td.creditor_account_id = ct.cond_account_id THEN 'creditor'
          ELSE NULL
        END as account_role
      FROM conditions_timeline ct
      LEFT JOIN transaction_detail td ON (
        (td.debtor_account_id = ct.cond_account_id OR td.creditor_account_id = ct.cond_account_id)
        AND td.tx_event_ts >= ct.cond_inception_ts
        AND td.tx_event_ts <= ct.cond_expiry_ts
        AND td.tenant_id = ct.cond_tenant_id
      )
      WHERE ct.cond_account_id IN (${accountFilter})
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_is_expired = 1
      ORDER BY ct.cond_expiry_ts DESC, td.tx_event_ts DESC
      LIMIT 1000
    `;

      this.logger.log(`Fetching expired conditions with transactions for accounts: ${accountFilter}`);
      const response = await this.runSqlQuery(sql, 1000);
      const rows = response.data ?? [];

      // Group by condition_id and aggregate transactions
      const conditionsMap = new Map();
      rows.forEach((r) => {
        if (!conditionsMap.has(r.condition_id)) {
          conditionsMap.set(r.condition_id, {
            conditionId: r.condition_id,
            title: r.condition_reason,
            type: r.condition_type,
            startDate: r.condition_inception_ts,
            endDate: r.condition_expiry_ts,
            accountId: r.account_id,
            transactions: [],
          });
        }
        // Add transaction if it exists
        if (r.transaction_id) {
          conditionsMap.get(r.condition_id).transactions.push({
            transactionId: r.transaction_id,
            endToEndId: r.end_to_end_id,
            type: r.tx_type,
            date: r.tx_event_ts,
            amount: r.interbank_settlement_amount,
            currency: r.interbank_settlement_currency,
            debtorId: r.debtor_id,
            creditorId: r.creditor_id,
            accountRole: r.account_role,
          });
        }
      });

      const conditions = Array.from(conditionsMap.values());

      // Determine if this was an entity-level query
      const isNumeric = /^\d+$/v.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/iv.test(identifier);
      const isEntityLevel = !isNumeric && !isUuid && accounts.length > 1;

      this.logger.log(`Found ${conditions.length} expired conditions with ${rows.length} total transaction links`);

      return {
        conditions,
        metadata: {
          queriedBy: identifier,
          accountCount: accounts.length,
          accounts: isEntityLevel ? accounts : undefined,
          isEntityLevel,
          totalTransactionLinks: rows.filter((r) => r.transaction_id).length,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching expired conditions', errorStack);
      throw new HttpException('Failed to fetch expired conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFutureConditions(identifier: string, tenantId = 'DEFAULT'): Promise<FutureConditionsResponse> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId);
      if (accounts.length === 0) {
        return {
          conditions: [],
          metadata: {
            queriedBy: identifier,
            accountCount: 0,
            accounts: [],
          },
        };
      }
      const accountFilter = accounts.map((a) => `'${a}'`).join(',');

      const sql = `
      SELECT
        ct.cond_condition_id as condition_id,
        ct.cond_reason as condition_reason,
        ct.cond_type as condition_type,
        ct.cond_inception_ts as condition_inception_ts,
        ct.cond_expiry_ts as condition_expiry_ts,
        ct.cond_account_id as account_id
      FROM conditions_timeline ct
      WHERE ct.cond_account_id IN (${accountFilter})
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_is_active = 0
        AND ct.cond_is_expired = 0
      ORDER BY ct.cond_inception_ts ASC
      LIMIT 500
    `;

      this.logger.log(`Fetching future conditions for accounts: ${accountFilter}`);
      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data ?? [];

      // Determine if this was an entity-level query
      const isNumeric = /^\d+$/v.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/iv.test(identifier);
      const isEntityLevel = !isNumeric && !isUuid && accounts.length > 1;

      this.logger.log(`Found ${rows.length} future conditions`);

      return {
        conditions: rows.map((r) => ({
          conditionId: r.condition_id,
          title: r.condition_reason,
          type: r.condition_type,
          startDate: r.condition_inception_ts,
          endDate: r.condition_expiry_ts,
          accountId: r.account_id,
          transactions: [], // Future conditions won't have transactions yet
        })),
        metadata: {
          queriedBy: identifier,
          accountCount: accounts.length,
          accounts: isEntityLevel ? accounts : undefined,
          isEntityLevel,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching future conditions', errorStack);
      throw new HttpException('Failed to fetch future conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvaluatedTransactions(identifier: string, tenantId = 'DEFAULT', fromDate?: string): Promise<unknown[]> {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId);
      if (accounts.length === 0) {
        return [];
      }

      const accountFilter = accounts.map((a) => `'${a}'`).join(',');
      const dateFilter = fromDate ? `AND ct.cond_inception_ts >= '${fromDate}'` : '';

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
        ct.cond_is_active,
        ct.cond_is_expired,
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
        AND td.tx_event_ts <= ct.cond_expiry_ts
        AND td.tenant_id = ct.cond_tenant_id
      )
      WHERE ct.cond_account_id IN (${accountFilter})
        AND ct.cond_tenant_id = '${tenantId}'
        ${dateFilter}
      ORDER BY td.tx_event_ts DESC
      LIMIT 500
    `;

      this.logger.log(`Fetching evaluated transactions with JOIN workaround for accounts: ${accountFilter}`);
      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} transactions evaluated during condition periods`);

      return rows.map((r) => ({
        transactionId: r.tx_transaction_id,
        date: r.tx_event_ts,
        type: r.tx_type,
        amount: r.tx_amount,
        currency: r.tx_ccy,
        outcome: r.cond_type === 'overridable-block' ? 'BLOCKED_OVERRIDABLE' : 'BLOCKED',
        conditionId: r.cond_condition_id,
        conditionType: r.cond_type,
        reason: r.cond_reason,
        conditionPeriod: {
          start: r.cond_inception_ts,
          end: r.cond_expiry_ts,
        },
        accountRole: r.account_role,
        accountId: r.cond_account_id,
      }));
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching evaluated transactions', errorStack);
      throw new HttpException('Failed to fetch evaluated transactions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ---------------- DEBUG METHODS FOR DATA ANALYSIS ----------------

  async getAllConditionsTableData(tenantId: string): Promise<ConditionsTableDataResponse> {
    try {
      this.logger.log('Fetching all conditions table data');
      const sql = `SELECT * FROM conditions WHERE tenant_id = '${tenantId}' LIMIT 500`;
      const response = await this.runSqlQuery(sql, 500);
      return {
        tableName: 'conditions',
        totalRows: response.data?.length ?? 0,
        data: response.data ?? [],
        note: 'Now using primary conditions table with full data (132 rows)',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching conditions table: ${errorMessage}`);
      throw new HttpException('Failed to fetch conditions table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAllConditionsTimelineData(tenantId: string): Promise<unknown> {
    try {
      this.logger.log('Fetching all conditions_timeline table data');
      const sql = 'SELECT * FROM conditions_timeline LIMIT 500';
      this.logger.debug(`SQL Query: ${sql}`);
      const response = await this.runSqlQuery(sql, 500);
      this.logger.log(`Conditions timeline response: ${JSON.stringify(response)}`);
      return {
        tableName: 'conditions_timeline',
        totalRows: response.data?.length ?? 0,
        data: response.data ?? [],
        note: 'Query executed without tenant filter to check table structure',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching conditions_timeline table: ${errorMessage}`);
      this.logger.error(`Error stack: ${errorStack}`);
      return {
        tableName: 'conditions_timeline',
        totalRows: 0,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Table may not exist or query failed',
      };
    }
  }

  // ---------------- SPECIFIC ID TYPE METHODS (NO RESOLUTION) ----------------

  async getConditionsSummaryByAccount(
    accountId: string,
    tenantId = 'DEFAULT',
    fromDate?: string,
    asOfDate?: string,
  ): Promise<AccountConditionsSummary> {
    try {
      this.logger.log(`Fetching conditions summary for account: ${accountId}`);

      let asOfDateFilter = '';
      if (asOfDate) {
        asOfDateFilter = `
          AND condition_inception_ts <= '${asOfDate}'
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= '${asOfDate}')
        `;
      }

      const sql = `
      SELECT 
        COUNT(*) as total_conditions,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_conditions,
        SUM(CASE WHEN is_expired = 1 THEN 1 ELSE 0 END) as expired_conditions,
        SUM(CASE WHEN is_active = 0 AND is_expired = 0 THEN 1 ELSE 0 END) as future_conditions
      FROM conditions
      WHERE account_id = '${accountId}'
        ${tenantId && tenantId !== 'DEFAULT' ? `AND tenant_id = '${tenantId}'` : ''}
        ${asOfDateFilter}
      `;

      const response = await this.runSqlQuery(sql, 1);
      const summary = response.data?.[0] ?? {};

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
      FROM conditions
      WHERE account_id = '${accountId}'
        ${tenantId && tenantId !== 'DEFAULT' ? `AND tenant_id = '${tenantId}'` : ''}
        ${asOfDateFilter}
      LIMIT 100
      `;

      const conditionsResponse = await this.runSqlQuery(conditionsSql, 100);
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

  async getActiveConditionsByAccount(accountId: string, tenantId = 'DEFAULT', fromDate?: string): Promise<unknown> {
    try {
      this.logger.log(`Fetching active conditions for account: ${accountId}`);

      const sql = `
      SELECT
        ct.condition_id,
        ct.condition_reason,
        ct.condition_type,
        ct.condition_inception_ts,
        ct.condition_expiry_ts,
        ct.account_id,
        ct.created_by_user
      FROM conditions ct
      WHERE (ct.account_id = '${accountId}' OR ct.entity_id = '${accountId}')
        ${tenantId && tenantId !== 'DEFAULT' ? `AND ct.tenant_id = '${tenantId}'` : ''}
        AND ct.is_active = 1
      ORDER BY ct.condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} active conditions for account ${accountId}`);

      return {
        conditions: rows.map((r) => ({
          conditionId: r.condition_id,
          title: r.condition_reason,
          type: r.condition_type,
          createdBy: r.created_by_user ?? 'no data found',
          startDate: r.condition_inception_ts,
          endDate: r.condition_expiry_ts ?? 'no data found',
          notes: r.condition_reason,
          action: r.condition_type === 'overridable-block' ? 'OVERRIDE' : 'BLOCK',
          accountId: r.account_id,
        })),
        metadata: {
          queriedBy: accountId,
          accountCount: 1,
          isEntityLevel: false,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching active conditions by account', errorStack);
      throw new HttpException('Failed to fetch active conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFutureConditionsByAccount(accountId: string, tenantId = 'DEFAULT'): Promise<FutureConditionsResponse> {
    try {
      this.logger.log(`Fetching future conditions for account: ${accountId}`);
      const sql = `
      SELECT
        ct.condition_id,
        ct.condition_reason,
        ct.condition_type,
        ct.condition_inception_ts,
        ct.condition_expiry_ts,
        ct.account_id,
        ct.created_by_user
      FROM conditions ct
      WHERE ct.account_id = '${accountId}'
        AND ct.tenant_id = '${tenantId}'
        AND ct.is_active = 0
        AND ct.is_expired = 0
      ORDER BY ct.condition_inception_ts ASC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} future conditions for account ${accountId}`);

      return {
        conditions: rows.map((r) => ({
          conditionId: r.condition_id,
          title: r.condition_reason,
          type: r.condition_type,
          createdBy: r.created_by_user ?? 'no data found',
          startDate: r.condition_inception_ts,
          endDate: r.condition_expiry_ts,
          accountId: r.account_id,
          transactions: [],
        })),
        metadata: {
          queriedBy: accountId,
          accountCount: 1,
          isEntityLevel: false,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching future conditions by account', errorStack);
      throw new HttpException('Failed to fetch future conditions', HttpStatus.INTERNAL_SERVER_ERROR);
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

      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= '${asOfDate}'
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= '${asOfDate}')
        `;
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
      WHERE ct.account_id = '${id}'
        ${tenantId && tenantId !== 'DEFAULT' ? `AND ct.tenant_id = '${tenantId}'` : ''}
        ${dateFilter}
      ORDER BY ct.condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500);
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
      const dateFilter = fromDate ? `AND ct.cond_inception_ts >= '${fromDate}'` : '';

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
        AND td.tx_event_ts <= ct.cond_expiry_ts
        AND td.tenant_id = ct.cond_tenant_id
      )
      WHERE ct.cond_account_id = '${accountId}'
        AND ct.cond_tenant_id = '${tenantId}'
        ${dateFilter}
      ORDER BY td.tx_event_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} transactions for account ${accountId}`);

      if (rows.length === 0) {
        return {
          transactions: [],
          metadata: {
            accountId,
            status: 'DATA_NOT_FOUND',
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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching evaluated transactions by account', errorStack);
      throw new HttpException('Failed to fetch evaluated transactions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Transaction ID based methods
  async getConditionsSummaryByTransaction(transactionId: number, tenantId = 'DEFAULT'): Promise<unknown> {
    try {
      this.logger.log(`Fetching conditions summary for transaction: ${transactionId}`);

      const txSql = `
      SELECT debtor_account_id, creditor_account_id, tx_event_ts
      FROM transaction_detail 
      WHERE transaction_id = ${transactionId} AND tenant_id = '${tenantId}'
      LIMIT 1
      `;

      const txResponse = await this.runSqlQuery(txSql, 1);
      const txData = txResponse.data?.[0];
      if (!txData) {
        return { message: `Transaction ${transactionId} not found`, conditions: 0 };
      }

      const condSql = `
      SELECT COUNT(*) as total_conditions,
             SUM(CASE WHEN cond_is_active = 1 THEN 1 ELSE 0 END) as active_conditions,
             SUM(CASE WHEN cond_is_expired = 1 THEN 1 ELSE 0 END) as expired_conditions
      FROM conditions_timeline ct
      WHERE (ct.cond_account_id = '${txData.debtor_account_id}' OR ct.cond_account_id = '${txData.creditor_account_id}')
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_inception_ts <= '${txData.tx_event_ts}'
        AND (ct.cond_expiry_ts IS NULL OR ct.cond_expiry_ts >= '${txData.tx_event_ts}')
      `;

      const response = await this.runSqlQuery(condSql, 1);
      const summary = response.data?.[0] ?? {};

      return {
        transactionId,
        transactionDate: txData.tx_event_ts,
        debtorAccount: txData.debtor_account_id,
        creditorAccount: txData.creditor_account_id,
        totalConditions: summary.total_conditions ?? 0,
        activeConditions: summary.active_conditions ?? 0,
        expiredConditions: summary.expired_conditions ?? 0,
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions summary by transaction', errorStack);
      throw new HttpException('Failed to fetch conditions summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExpiredConditionsByTransaction(transactionId: number, tenantId = 'DEFAULT'): Promise<unknown> {
    try {
      this.logger.log(`Fetching expired conditions for transaction: ${transactionId}`);

      const txSql = `
      SELECT debtor_account_id, creditor_account_id, tx_event_ts
      FROM transaction_detail 
      WHERE transaction_id = ${transactionId} AND tenant_id = '${tenantId}'
      LIMIT 1
      `;

      const txResponse = await this.runSqlQuery(txSql, 1);
      const txData = txResponse.data?.[0];
      if (!txData) {
        return { conditions: [], metadata: { transactionId, message: 'Transaction not found' } };
      }

      const condSql = `
      SELECT
        ct.cond_condition_id as condition_id,
        ct.cond_reason as condition_reason,
        ct.cond_type as condition_type,
        ct.cond_inception_ts as condition_inception_ts,
        ct.cond_expiry_ts as condition_expiry_ts,
        ct.cond_account_id as account_id,
        CASE 
          WHEN ct.cond_account_id = '${txData.debtor_account_id}' THEN 'debtor'
          WHEN ct.cond_account_id = '${txData.creditor_account_id}' THEN 'creditor'
          ELSE 'unknown'
        END as account_role
      FROM conditions_timeline ct
      WHERE (ct.cond_account_id = '${txData.debtor_account_id}' OR ct.cond_account_id = '${txData.creditor_account_id}')
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_is_expired = 1
        AND ct.cond_inception_ts <= '${txData.tx_event_ts}'
        AND ct.cond_expiry_ts >= '${txData.tx_event_ts}'
      ORDER BY ct.cond_expiry_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(condSql, 500);
      const rows = response.data ?? [];

      return {
        conditions: rows.map((r) => ({
          conditionId: r.condition_id,
          title: r.condition_reason,
          type: r.condition_type,
          startDate: r.condition_inception_ts,
          endDate: r.condition_expiry_ts,
          accountId: r.account_id,
          accountRole: r.account_role,
        })),
        metadata: {
          queriedBy: transactionId,
          transactionDate: txData.tx_event_ts,
          debtorAccount: txData.debtor_account_id,
          creditorAccount: txData.creditor_account_id,
          totalFound: rows.length,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching expired conditions by transaction', errorStack);
      throw new HttpException('Failed to fetch expired conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionDetails(conditionId: string, tenantId = 'DEFAULT'): Promise<unknown> {
    try {
      this.logger.log(`Fetching condition details for: ${conditionId}`);
      const sql = `
      SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY cond_condition_id ORDER BY bucket_start DESC) as latest_v
      FROM conditions_timeline
      WHERE cond_condition_id = '${conditionId}'
        ${tenantId && tenantId !== 'DEFAULT' ? `AND cond_tenant_id = '${tenantId}'` : ''}
      LIMIT 1
      `;

      const response = await this.runSqlQuery(sql, 1);
      const raw = response.data?.[0];

      if (!raw) {
        throw new HttpException('Condition not found', HttpStatus.NOT_FOUND);
      }

      const row = this.stripHudiMetadata(raw);
      return {
        conditionId: row.cond_condition_id,
        reason: row.cond_reason ?? 'no data found',
        type: row.cond_type ?? 'no data found',
        startDate: row.cond_inception_ts,
        endDate: row.cond_expiry_ts ?? 'no data found',
        status: row.cond_is_active === 1 ? 'active' : row.cond_is_expired === 1 ? 'expired' : 'future',
        accountId: row.cond_account_id,
        entityId: row.cond_entity_id ?? 'no data found',
        tenantId: row.cond_tenant_id,
        transactionId: row.tx_transaction_id ?? 'no data found',
        metadata: {
          queryTimestamp: new Date().toISOString(),
          bucketGranularity: row.bucket_granularity ?? 'no data found',
          bucketStart: row.bucket_start,
          createdDate: row.cond_created_ts,
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching condition details', errorStack);
      throw new HttpException('Failed to fetch condition details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsContextByTransaction(
    transactionId: number,
    tenantId = 'DEFAULT',
    asOfDate?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    try {
      this.logger.log(`Fetching conditions context for transaction: ${transactionId}`);

      const txSql = `
      SELECT 
        transaction_id,
        end_to_end_id,
        tx_event_ts,
        tx_event_date,
        tx_type,
        interbank_settlement_amount,
        interbank_settlement_currency,
        debtor_id,
        debtor_name,
        debtor_account_id,
        creditor_id,
        creditor_name,
        creditor_account_id
      FROM transaction_detail 
      WHERE transaction_id = ${transactionId} 
        AND tenant_id = '${tenantId}'
      LIMIT 1
      `;

      const txResponse = await this.runSqlQuery(txSql, 1);
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
        WHERE source = '${entityId}'
          AND tenant_id = '${tenantId}'
        `;

        const accountsResponse = await this.runSqlQuery(accountsSql, 100);
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
              WHEN condition_inception_ts <= '${asOfDate}' 
              AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= '${asOfDate}')
              AND is_active = 1 
              THEN 1 ELSE 0 
            END) as active,
            SUM(CASE 
              WHEN condition_expiry_ts < '${asOfDate}' 
              AND is_expired = 1 
              THEN 1 ELSE 0 
            END) as expired,
            SUM(CASE 
              WHEN condition_inception_ts > '${asOfDate}' 
              AND is_active = 0 
              AND is_expired = 0 
              THEN 1 ELSE 0 
            END) as future
          FROM conditions
          WHERE account_id = '${accountId}'
            AND tenant_id = '${tenantId}'
          `;

          const countsResponse = await this.runSqlQuery(conditionsSql, 1);
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
      WHERE source = '${entityId}'
        AND tenant_id = '${tenantId}'
      `;

      const accountsResponse = await this.runSqlQuery(accountsSql, 100);
      const accountIds = accountsResponse.data?.map((r) => r.account_id).filter(Boolean) ?? [];

      if (accountIds.length === 0) {
        return {
          entityId,
          accounts: [],
          conditions: [],
          metadata: {
            message: 'No accounts found for this entity',
            queryTimestamp: new Date().toISOString(),
          },
        };
      }

      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= '${asOfDate}'
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= '${asOfDate}')
        `;
      }

      const accountFilter = accountIds.map((id) => `'${id}'`).join(',');
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
      WHERE ((account_id IN (${accountFilter}) AND identity_type = 'ACCOUNT')
             OR (entity_id = '${entityId}' AND identity_type = 'ENTITY'))
        AND tenant_id = '${tenantId}'
        ${dateFilter}
      ORDER BY condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(conditionsSql, 500);
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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching conditions by entity', errorStack);
      throw new HttpException('Failed to fetch conditions by entity', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
