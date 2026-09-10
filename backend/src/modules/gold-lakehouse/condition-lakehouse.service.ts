import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { ConditionsByEntityResponse, ConditionsContextByTransactionResponse } from './types/gold-lakehouse-responses.types';
import { ConditionsListByAccountResponse } from './types/IAccountConditions.types';

@Injectable()
export class ConditionLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
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
      const tenantFilter = `AND ct.tenant_id = $${params.length + 1}`;
      params.push(tenantId);

      let dateFilter = '';
      if (asOfDate) {
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

      const formattedConditions = rows.map((row) => ({
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

  // Transaction ID based methods

  async getConditionsContextByTransaction(
    transactionId: string,
    tenantId: string,
    asOfDate?: string,
    userJwt?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    try {
      const txSql =
        'SELECT transaction_id, end_to_end_id, tx_event_ts, tx_event_date, tx_type, interbank_settlement_amount, interbank_settlement_currency, debtor_id, debtor_name, debtor_account_id, creditor_id, creditor_name, creditor_account_id FROM transaction_detail WHERE end_to_end_id = $1 AND tenant_id = $2 LIMIT 100;';

      const txResponse = await this.runSqlQuery(txSql, 1, [transactionId, tenantId], userJwt);
      const pacs8 = txResponse.data.find((record) => record.tx_type === 'pacs.008.001.10');

      this.logger.log(`Transaction details for ${transactionId}:`, txResponse.data);

      if (!pacs8) {
        throw new HttpException(`Transaction ${transactionId} not found`, HttpStatus.NOT_FOUND);
      }

      const filterDate = asOfDate ?? pacs8.tx_event_ts;

      // const displayId = `TXN-${pacs8.tx_event_date?.replace(/-/gv, '')}${transactionId}`;
      const dateSegment = pacs8.tx_event_date?.replace(/-/gv, '') ?? '';
      const displayId = `TXN-${dateSegment}${transactionId}`;
      const debtorAccounts = await this.getEntityAccountsWithConditionCounts(
        pacs8.debtor_id,
        pacs8.debtor_account_id,
        tenantId,
        filterDate,
        userJwt,
      );

      const creditorAccounts = await this.getEntityAccountsWithConditionCounts(
        pacs8.creditor_id,
        pacs8.creditor_account_id,
        tenantId,
        filterDate,
        userJwt,
      );
      this.logger.log(`Debtor accounts for transaction ${transactionId}:`, debtorAccounts);
      this.logger.log(`Creditor accounts for transaction ${transactionId}:`, creditorAccounts);

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
        },
        creditor: {
          entityId: pacs8.creditor_id ?? 'no data found',
          entityName: pacs8.creditor_name ?? 'no data found',
          primaryAccountId: pacs8.creditor_account_id ?? 'no data found',
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
    userJwt?: string,
  ): Promise<
    Array<{
      accountId: string;
      accountNumber: string;
      isTransactionAccount: boolean;
      activeConditionsCount: number;
      expiredConditionsCount: number;
      futureConditionsCount: number;
    }>
  > {
    try {
      const accountIdsSet = new Set<string>();

      this.logger.log(`Fetching accounts for entity ${entityId} with primary account ${primaryAccountId}`);

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
        const enhancedEntityId = `${entityId}TAZAMA_EID`;
        const accountsResponse = await this.runSqlQuery(accountsSql, 100, [enhancedEntityId, tenantId], userJwt);

        this.logger.log(`Accounts for entity ${entityId}:`, accountsResponse.data);

        accountsResponse.data?.forEach((r) => {
          if (r.account_id) {
            accountIdsSet.add(r.account_id);
          }
        });
      }

      const accountIds = Array.from(accountIdsSet);

      this.logger.log(
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
          let accountIdToUse = accountId;
          if (accountIdToUse.includes('dbtrAcct_') || accountIdToUse.includes('cdtrAcct_')) {
            accountIdToUse = accountIdToUse.slice(9);
          }

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
          WHERE condition_key_key = $2
            AND tenant_id = $3
          `;

          const countsResponse = await this.runSqlQuery(conditionsSql, 1, [asOfDate, accountIdToUse, tenantId], userJwt);

          this.logger.log(`Condition counts for ${accountIdToUse}:`, countsResponse);

          const counts = countsResponse.data?.[0] ?? {};

          const accountNumber = accountId.slice(-12);

          return {
            accountId,
            accountNumber: `****${accountNumber}`,
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
      this.logger.log(`Fetching conditions for entity: ${entityId}`);

      const accountsSql = `
      SELECT DISTINCT destination as account_id
      FROM account_holder
      WHERE source = $1
        AND tenant_id = $2
      `;

      const accountsResponse = await this.runSqlQuery(accountsSql, 100, [entityId, tenantId], userJwt);
      this.logger.log(`Accounts for entity ${entityId}:`, accountsResponse.data);
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
      this.logger.log(`Conditions for entity ${entityId}:`, response.data);
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
