import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import {
  ConditionsByEntityResponse,
  ConditionsContextByTransactionResponse,
  FormattedConditionRecord,
} from './types/gold-lakehouse-responses.types';
import { ConditionsListByAccountResponse } from './types/IAccountConditions.types';

@Injectable()
export class ConditionLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  // Classifies a condition against asOfDate from its own inception/expiry
  // timestamps, rather than the lakehouse's precomputed is_active/is_expired
  // columns - those reflect the ETL's real ingestion time, which drifts from
  // a historical asOfDate. Single source of truth for both per-condition
  // flags and aggregate counts, so the two never disagree.
  private classifyConditionByDate(
    inceptionTs: string | null | undefined,
    expiryTs: string | null | undefined,
    asOfDate: string,
  ): 'active' | 'expired' | 'future' | 'unclassified' {
    const asOfTime = new Date(asOfDate).getTime();
    const inceptionTime = inceptionTs ? new Date(inceptionTs).getTime() : null;
    const expiryTime = expiryTs ? new Date(expiryTs).getTime() : null;

    if (inceptionTime !== null && inceptionTime <= asOfTime && (expiryTime === null || expiryTime >= asOfTime)) {
      return 'active';
    }
    if (expiryTime !== null && expiryTime < asOfTime) {
      return 'expired';
    }
    if (inceptionTime !== null && inceptionTime > asOfTime) {
      return 'future';
    }
    return 'unclassified';
  }

  private formatConditionRow(row: any, tenantId: string, asOfDate: string): FormattedConditionRecord {
    const classification = this.classifyConditionByDate(row.condition_inception_ts, row.condition_expiry_ts, asOfDate);
    return {
      conditionId: row.condition_id,
      pk: row.pk ?? 'no mapping found',
      tenantId: row.tenant_id ?? tenantId,
      accountId: row.account_id,
      accountScheme: row.account_scheme ?? 'no data found',
      type: row.condition_type ?? 'no data found',
      perspective: row.perspective ?? 'no data found',
      reason: row.condition_reason ?? 'no data found',
      eventTypes: row.event_types_csv ?? 'no data found',
      inceptionDate: row.condition_inception_ts,
      expiryDate: row.condition_expiry_ts,
      createdDate: row.condition_created_ts,
      isActive: classification === 'active',
      isExpired: classification === 'expired',
      createdBy: row.created_by_user ?? 'no data found',
    };
  }

  async getConditionsListByAccount(
    id: string,
    tenantId: string,
    asOfDate?: string,
    showInactive = true,
    userJwt?: string,
  ): Promise<ConditionsListByAccountResponse> {
    try {
      this.logger.log(`Fetching all conditions for ID: ${id}`);

      const params: any[] = [id];
      const tenantFilter = `AND tenant_id = $${params.length + 1}`;
      params.push(tenantId);

      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= $${params.length + 1}
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= $${params.length + 1})
        `;
        params.push(asOfDate);
      }

      const sql = `
      SELECT pk, condition_id, condition_reason, condition_type, perspective, condition_inception_ts, condition_expiry_ts, condition_created_ts,
      is_active, is_expired, account_id, tenant_id, account_scheme, event_types_csv, created_by_user FROM conditions WHERE account_id = $1 
      ${tenantFilter} 
      ${dateFilter} 
      ORDER BY condition_inception_ts DESC 
      LIMIT 500
      `;

      const response = await this.runSqlQuery(sql, 500, params, userJwt);
      const rows = response.data ?? [];

      this.logger.log(`Found ${rows.length} conditions for ID ${id}`);

      // No asOfDate means the caller isn't asking for a historical view, so
      // classify against right now - same convention as elsewhere in this
      // service when a point-in-time reference is otherwise unavailable.
      const effectiveAsOfDate = asOfDate ?? new Date().toISOString();
      const formattedConditions = rows.map((row) => this.formatConditionRow(row, tenantId, effectiveAsOfDate));

      this.logger.log(`Formatted ${JSON.stringify(formattedConditions)}, rows: ${JSON.stringify(rows)} conditions for ID ${id}`);

      let activeCount = 0;
      let expiredCount = 0;
      let futureCount = 0;
      for (const row of rows) {
        const classification = this.classifyConditionByDate(row.condition_inception_ts, row.condition_expiry_ts, effectiveAsOfDate);
        if (classification === 'active') {
          activeCount += 1;
        } else if (classification === 'expired') {
          expiredCount += 1;
        } else if (classification === 'future') {
          futureCount += 1;
        }
      }

      return {
        accountId: id,
        totalConditions: rows.length,
        conditions: formattedConditions,
        metadata: {
          activeCount,
          expiredCount,
          futureCount,
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

  // Transaction ID based methods

  async getConditionsContextByTransaction(
    transactionId: string,
    tenantId: string,
    asOfDate?: string,
    userJwt?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    try {
      const txSql =
        'SELECT transaction_id, end_to_end_id, tx_event_ts, tx_event_date, tx_type, interbank_settlement_amount, interbank_settlement_currency, debtor_id, debtor_name, debtor_account_id, creditor_id, creditor_name, creditor_account_id FROM transaction_detail WHERE end_to_end_id = $1 AND tenant_id = $2;';

      const txResponse = await this.runSqlQuery(txSql, 100, [transactionId, tenantId], userJwt);
      const pacs8 = txResponse.data.find((record) => record.tx_type === 'pacs.008.001.10');

      if (!pacs8) {
        throw new HttpException(`Transaction ${transactionId} not found`, HttpStatus.NOT_FOUND);
      }

      const filterDate = asOfDate ?? pacs8.tx_event_ts;

      // const displayId = `TXN-${pacs8.tx_event_date?.replace(/-/gv, '')}${transactionId}`;
      const dateSegment = pacs8.tx_event_date?.replace(/-/gv, '') ?? '';
      const displayId = `TXN-${dateSegment}${transactionId}`;
      const [debtorAccounts, creditorAccounts, debtorEntityConditions, creditorEntityConditions] = await Promise.all([
        this.getEntityAccountsWithConditionCounts(pacs8.debtor_id, pacs8.debtor_account_id, tenantId, filterDate, userJwt),
        this.getEntityAccountsWithConditionCounts(pacs8.creditor_id, pacs8.creditor_account_id, tenantId, filterDate, userJwt),
        this.getEntityLevelConditions(pacs8.debtor_id, tenantId, filterDate, userJwt),
        this.getEntityLevelConditions(pacs8.creditor_id, tenantId, filterDate, userJwt),
      ]);

      return {
        transaction: {
          transactionId: pacs8.transaction_id,
          displayId,
          endToEndId: pacs8.end_to_end_id ?? 'no data found',
          timestamp: pacs8.tx_event_ts,
          type: pacs8.tx_type ?? 'no data found',
          amount: pacs8.interbank_settlement_amount,
          currency: pacs8.interbank_settlement_currency ?? 'no data found',
        },
        debtor: {
          entityId: pacs8.debtor_id ?? 'no data found',
          entityName: pacs8.debtor_name ?? 'no data found',
          primaryAccountId: pacs8.debtor_account_id ?? 'no data found',
          accounts: debtorAccounts,
          entityConditions: debtorEntityConditions,
        },
        creditor: {
          entityId: pacs8.creditor_id ?? 'no data found',
          entityName: pacs8.creditor_name ?? 'no data found',
          primaryAccountId: pacs8.creditor_account_id ?? 'no data found',
          accounts: creditorAccounts,
          entityConditions: creditorEntityConditions,
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

  // Conditions placed directly against the entity (target_type = 'ENTITY'),
  // as distinct from conditions scoped to one of its accounts.
  private async getEntityLevelConditions(
    entityId: string,
    tenantId: string,
    asOfDate: string,
    userJwt?: string,
  ): Promise<FormattedConditionRecord[]> {
    if (!entityId || entityId === 'no data found') {
      return [];
    }

    const sql = `
    SELECT pk, condition_id, condition_reason, condition_type, perspective, condition_inception_ts, condition_expiry_ts, condition_created_ts,
    is_active, is_expired, account_id, tenant_id, account_scheme, event_types_csv, created_by_user
    FROM conditions
    WHERE entity_id = $1
      AND target_type = 'ENTITY'
      AND tenant_id = $2
    ORDER BY condition_inception_ts DESC
    LIMIT 500
    `;

    const response = await this.runSqlQuery(sql, 500, [entityId, tenantId], userJwt);
    const rows = response.data ?? [];

    return rows.map((row) => this.formatConditionRow(row, tenantId, asOfDate));
  }

  private async getEntityAccountsWithConditionCounts(
    entityId: string,
    primaryAccountId: string,
    tenantId: string,
    asOfDate: string,
    userJwt?: string,
  ): Promise<
    Array<{
      accountId: string;
      accountNumber: string;
      isTransactionAccount: boolean;
      activeConditionsCount: number;
      expiredConditionsCount: number;
      futureConditionsCount: number;
      conditions: FormattedConditionRecord[];
    }>
  > {
    try {
      const accountIdsSet = new Set<string>();

      if (entityId && entityId !== 'no data found') {
        const accountsSql = `
        SELECT DISTINCT destination as account_id
        FROM account_holder
        WHERE source = $1
          AND tenant_id = $2
        `;
        const enhancedEntityId = `${entityId}TAZAMA_EID`;
        const accountsResponse = await this.runSqlQuery(accountsSql, 100, [enhancedEntityId, tenantId], userJwt);

        accountsResponse.data?.forEach((r) => {
          if (r.account_id) {
            accountIdsSet.add(r.account_id);
          }
        });
      }

      const accountIds = Array.from(accountIdsSet);

      if (accountIds.length === 0) {
        this.logger.warn(`No accounts found for entity ${entityId}`);
        return [];
      }

      const accountsWithCounts = await Promise.all(
        accountIds.map(async (accountId) => {
          const conditionsSql = `
          SELECT pk, condition_id, condition_reason, condition_type, perspective, condition_inception_ts, condition_expiry_ts, condition_created_ts,
          is_active, is_expired, account_id, tenant_id, account_scheme, event_types_csv, created_by_user
          FROM conditions
          WHERE condition_key_key = $1
            AND tenant_id = $2
          `;
          const rowsResponse = await this.runSqlQuery(conditionsSql, 500, [accountId, tenantId], userJwt);
          const rows = rowsResponse.data ?? [];

          let activeConditionsCount = 0;
          let expiredConditionsCount = 0;
          let futureConditionsCount = 0;
          for (const row of rows) {
            const classification = this.classifyConditionByDate(row.condition_inception_ts, row.condition_expiry_ts, asOfDate);
            if (classification === 'active') {
              activeConditionsCount += 1;
            } else if (classification === 'expired') {
              expiredConditionsCount += 1;
            } else if (classification === 'future') {
              futureConditionsCount += 1;
            }
          }

          const accountNumber = accountId.slice(-12);

          // accountId here is the condition_key_key-style composite (account_id +
          // account_scheme + account_agent_mmb_id, e.g. "da3715...aMSISDNfsp001"),
          // but primaryAccountId (from transaction_detail) is the plain account_id
          // (e.g. "da3715...a") - comparing them directly would never match.
          // conditions.account_id carries the plain form, so use it when this
          // account has any conditions; otherwise fall back to a prefix check,
          // since the composite is always accountId+scheme+agent with no separator.
          const plainAccountId = rows[0]?.account_id ?? (accountId.startsWith(primaryAccountId) ? primaryAccountId : accountId);

          return {
            accountId,
            accountNumber: `****${accountNumber}`,
            isTransactionAccount: plainAccountId === primaryAccountId,
            activeConditionsCount,
            expiredConditionsCount,
            futureConditionsCount,
            conditions: rows.map((row) => ({ ...this.formatConditionRow(row, tenantId, asOfDate), accountId })),
          };
        }),
      );

      return accountsWithCounts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error fetching entity accounts with condition counts: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getConditionsByEntity(
    entityId: string,
    tenantId: string,
    asOfDate?: string,
    showInactive = false,
    userJwt?: string,
  ): Promise<ConditionsByEntityResponse> {
    try {
      const accountsSql = `
      SELECT DISTINCT destination as account_id
      FROM account_holder
      WHERE source = $1
        AND tenant_id = $2
      `;

      const accountsResponse = await this.runSqlQuery(accountsSql, 100, [entityId, tenantId], userJwt);
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
      WHERE ((account_id IN (${accountPlaceholders}) AND target_type = 'ACCOUNT')
             OR (entity_id = $2 AND target_type = 'ENTITY'))
        AND tenant_id = $1
        ${dateFilter}
      ORDER BY condition_inception_ts DESC
      LIMIT 500
      `;

      const response = await this.runSqlQuery(conditionsSql, 500, params, userJwt);
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
