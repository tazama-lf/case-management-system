import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QueryRequestDto } from './dto/query-request.dto';
import { QueryResponseDto } from './dto/query-response.dto';
import {
  TransactionNetworkResponseDto,
  ConnectedAccountDto,
  CenterAccountDto,
  NetworkSummaryDto,
  TransactionStatsDto,
  NetworkEdgeDto,
  CounterpartyNetworkResponseDto,
  CounterpartyDto,
  CenterCounterpartyDto,
  CounterpartyNetworkSummaryDto,
  CounterpartyNetworkEdgeDto,
} from './dto/network-analysis.dto';
import { Alerts, Cumulative, Edge, Node, RecentTransaction, Timeline } from './types/gold-lakehouse.types';

@Injectable()
export class GoldLakehouseService {
  private readonly logger = new Logger(GoldLakehouseService.name);
  private readonly apiUrl: string;
  private readonly timeout: number;
  private readonly alertHistoryFallbackE2EId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('GOLD_LAKEHOUSE_API_URL');
    this.timeout = this.configService.get<number>('GOLD_LAKEHOUSE_TIMEOUT') ?? 30000;
    this.alertHistoryFallbackE2EId = this.configService.get<string>('ALERT_HISTORY_FALLBACK_E2E_ID', '05c7ead85a1343d5a959561523a965fb');
  }

  async query(queryRequest: QueryRequestDto): Promise<QueryResponseDto> {
    try {
      this.logger.log(`Querying Gold Lakehouse table: ${queryRequest.table_name}`);
      this.logger.log(`API URL: ${this.apiUrl}/query`);
      this.logger.log(`Request body: ${JSON.stringify(queryRequest)}`);

      const response = await firstValueFrom(
        this.httpService.post<QueryResponseDto>(`${this.apiUrl}/query`, queryRequest, { timeout: this.timeout }),
      );

      if (response.data.status !== 'success') {
        throw new HttpException(
          `Gold Lakehouse query failed with status: ${response.data.status}`,
          response.data.code || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error querying Gold Lakehouse: ${errorMessage}`);

      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED') {
        this.logger.error(`Gold Lakehouse API is not reachable at ${this.apiUrl}`);
        throw new HttpException(`Gold Lakehouse API is not running or not reachable at ${this.apiUrl}`, HttpStatus.SERVICE_UNAVAILABLE);
      }

      if (error && typeof error === 'object' && 'response' in error) {
        const response = error.response as { status?: number; data?: unknown };
        this.logger.error(`Response status: ${response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(response.data)}`);
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(`Failed to query Gold Lakehouse: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async runSqlQuery(sql: string, limit = 1): Promise<any> {
    try {
      this.logger.log('Running raw SQL query on Gold Lakehouse');
      this.logger.debug(sql);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/execute_sql`,
          {
            sql_query: sql,
            limit,
          },
          { timeout: this.timeout },
        ),
      );

      if (response.data.status !== 'success') {
        throw new HttpException('Gold Lakehouse SQL query failed', response.data.code ?? HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error running SQL query: ${errorMessage}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Failed to run SQL query on Gold Lakehouse', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertNavigatorMetrics(
    alertId: number,
    tenantId = 'DEFAULT',
  ): Promise<{
    total_typologies: number;
    total_rules: number;
    avg_typology_score: number | null;
    alertId: number;
    tenantId: string;
  }> {
    try {
      this.logger.log(`Fetching Alert Navigator metrics for alert: ${alertId}`);

      const sql = `
      SELECT
        COUNT(DISTINCT t.typology_id) AS total_typologies,
        COUNT(DISTINCT r.rule_id)     AS total_rules,
        AVG(t.typology_score)         AS avg_typology_score
      FROM alert_navigator_header h
      LEFT JOIN alert_navigator_typologies t
        ON t.alert_id = h.alert_id
      AND t.tenant_id = h.tenant_id
      LEFT JOIN alert_navigator_rules r
        ON r.alert_id = h.alert_id
      AND r.tenant_id = h.tenant_id
      AND r.rule_weight > 0
      WHERE h.alert_id = ${alertId}
        AND h.tenant_id = '${tenantId}'
      `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response?.data?.[0];

      return {
        total_typologies: Number(row?.total_typologies ?? 0),
        total_rules: Number(row?.total_rules ?? 0),
        avg_typology_score: row?.avg_typology_score === null ? null : Number(row.avg_typology_score),
        alertId,
        tenantId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Alert Navigator metrics: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to fetch Alert Navigator metrics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertNavigatorData(
    alertId: number,
    tenantId = 'DEFAULT',
  ): Promise<{
    alertMetadata: {
      alertId: number;
      transactionId: string;
      timestamp: string;
      transactionType: string;
      amount: number;
      currency: string;
      status: string;
      reason: string;
      blockReason: string;
    };
    typologies: Array<{
      typologyId: string;
      typologyCfg: string;
      typologyScore: number;
      alertThreshold: number;
      interdictionThreshold: number;
      ruleCount: number;
      rules: string;
    }>;
    statistics: {
      totalTypologies: number;
      totalRules: number;
      avgScore: number;
    };
    meta: {
      alertId: number;
      tenantId: string;
    };
  }> {
    try {
      this.logger.log(`Fetching Alert Navigator data for alert: ${alertId}`);

      // Fetch alert with transaction data using SQL JOIN
      const alertWithTransactionResponse = await this.runSqlQuery(
        `
        SELECT 
          h.*,
          a.alert_id as alert_alert_id,
          a.alert_status,
          a.tx_type as alert_tx_type,
          a.tx_amount as alert_tx_amount,
          a.tx_ccy as alert_tx_ccy,
          a.created_at_ts,
          t.transaction_id as tx_transaction_id,
          t.end_to_end_id,
          t.tx_msg_id,
          t.tx_amount,
          t.tx_ccy,
          t.event_ts,
          t.tx_status,
          t.tx_type,
          t.instg_mmb_id,
          t.instd_mmb_id
        FROM alert_navigator_header h
        LEFT JOIN alerts a ON h.alert_id = a.alert_id AND h.tenant_id = a.tenant_id
        LEFT JOIN transactions t ON (
          (a.tx_msg_id IS NOT NULL AND t.tx_msg_id = a.tx_msg_id) OR
          (h.end_to_end_id IS NOT NULL AND t.end_to_end_id = h.end_to_end_id) OR
          (h.transaction_id IS NOT NULL AND t.transaction_id = h.transaction_id)
        ) AND t.tenant_id = h.tenant_id
        WHERE h.alert_id = ${alertId}
          AND h.tenant_id = '${tenantId}'
        LIMIT 1
        `,
        1,
      );

      const [typologiesResponse] = await Promise.all([
        this.query({
          table_name: 'alert_navigator_typologies',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
      ]);

      // Fetch rules with rule_weight > 0 using SQL
      const rulesResponse = await this.runSqlQuery(
        `
        SELECT r.*, rules.rule_desc
        FROM alert_navigator_rules r
        LEFT JOIN rules ON r.rule_id = rules.rule_id
        WHERE r.alert_id = ${alertId}
          AND r.tenant_id = '${tenantId}'
          AND r.rule_weight > 0
        `,
        1000,
      );

      const combinedRaw = alertWithTransactionResponse?.data?.[0];

      if (!combinedRaw) {
        throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
      }

      const combined = this.stripHudiMetadata(combinedRaw);
      const typologiesRaw = typologiesResponse.data || [];
      const rulesRaw = rulesResponse?.data ?? [];

      // Alert Metadata
      const alertMetadata = {
        alertId: Number(combined.alert_id),
        transactionId: String(combined.tx_transaction_id) || String(combined.end_to_end_id) || String(combined.transaction_id),
        timestamp: String(combined.created_at_ts) || String(combined.ingested_at_ts),
        transactionType: String(combined.alert_tx_type) || String(combined.tx_type),
        amount: Number(combined.alert_tx_amount) || Number(combined.tx_amount),
        currency: String(combined.alert_tx_ccy) || String(combined.tx_ccy),
        status: String(combined.alert_status),
        reason: String(combined.alert_reason),
        blockReason: String(combined.block_or_override_status),
      };

      // Typologies
      const typologies = typologiesRaw.map((t) => {
        const typology = this.stripHudiMetadata(t);

        // Find rules that belong to this typology
        const typologyRules = rulesRaw
          .filter((r) => {
            const rule = this.stripHudiMetadata(r);
            return rule.typology_cfg === typology.typology_cfg;
          })
          .map((r) => {
            const rule = this.stripHudiMetadata(r);
            return {
              ruleId: rule.rule_id,
              ruleDesc: rule.rule_desc,
              ruleWeight: rule.rule_weight,
              subRef: rule.rule_sub_ref,
            };
          });

        return {
          typologyId: String(typology.typology_id),
          typologyCfg: String(typology.typology_cfg),
          typologyScore: Number(typology.typology_score),
          alertThreshold: Number(typology.alert_threshold),
          interdictionThreshold: Number(typology.interdiction_threshold),
          ruleCount: Number(typology.rule_count_in_typology),
          rules: String(typologyRules),
        };
      });

      // Calculate summary statistics
      const totalTypologies = typologies.length;
      const totalRules = rulesRaw.length;
      const avgScore = totalTypologies > 0 ? typologies.reduce((sum, t) => sum + t.typologyScore, 0) / totalTypologies : 0;

      return {
        alertMetadata,
        typologies,
        statistics: {
          totalTypologies,
          totalRules: Number(totalRules),
          avgScore: Math.round(avgScore * 100) / 100,
        },
        meta: {
          alertId,
          tenantId,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Alert Navigator data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Alert Navigator data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionDetailData(transactionId: number, tenantId = 'DEFAULT') {
    try {
      this.logger.log(`Fetching Transaction Detail UI data for transaction: ${transactionId}`);

      const response = await this.query({
        table_name: 'transaction_detail',
        filters: {
          transaction_id: transactionId,
          tenant_id: tenantId,
        },
        columns: [
          'transaction_id',
          'tx_event_ts',
          'tx_type',
          'interbank_settlement_amount',
          'interbank_settlement_currency',
          'debtor_name',
          'debtor_account_id',
          'creditor_name',
          'creditor_account_id',
          'instg_mmb_id',
          'instd_mmb_id',
          'instructed_amount',
          'instructed_currency',
          'exchange_rate',
          'charge_total_amount',
          'charge_currency',
          'tx_event_date',
        ],
      });

      const rowRaw = response.data?.[0];
      if (!rowRaw) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      const row = this.stripHudiMetadata(rowRaw);

      // Transform to frontend-expected format
      return {
        transactionOverview: {
          transactionId: String(row.transaction_id),
          transactionType: String(row.tx_type),
          timestamp: String(row.tx_event_ts),
        },
        transactionFlow: {
          debtor: {
            name: String(row.debtor_name),
            account: {
              iban: String(row.debtor_account_id),
              type: 'CHECKING',
            },
            bank: String(row.instd_mmb_id),
          },
          amount: {
            amount: Number(row.interbank_settlement_amount),
            currency: String(row.interbank_settlement_currency) || 'USD',
          },
          creditor: {
            name: String(row.creditor_name),
            account: {
              iban: String(row.creditor_account_id),
              type: 'CHECKING',
            },
            bankName: String(row.instg_mmb_id),
          },
        },
        debtorProfile: {
          name: String(row.debtor_name),
          account: {
            iban: String(row.debtor_account_id),
            type: 'CHECKING',
          },
          bank: String(row.instd_mmb_id),
          swiftCode: '',
          address: '',
          accountType: 'CHECKING',
        },
        creditorProfile: {
          name: String(row.creditor_name),
          account: {
            iban: String(row.creditor_account_id),
            type: 'CHECKING',
          },
          bank: String(row.instg_mmb_id),
          swiftCode: '',
          address: '',
          accountType: 'CHECKING',
        },
        amountAndCurrency: [
          {
            originalAmount: Number(row.instructed_amount) || 0,
            exchangeRate: Number(row.exchange_rate) || 1,
            convertedAmount: Number(row.interbank_settlement_amount) || 0,
          },
          {
            senderCharges: [],
            intermediaryCharges: [],
            receiverCharges: [],
          },
          {
            totalCharges: Number(row.charge_total_amount),
          },
        ],
        settlementDetails: {
          settlementDate: String(row.tx_event_date),
          reference: String(row.transaction_id),
          purpose: '',
        },
        links: [
          {
            rel: 'self',
            href: `/api/v1/lakehouse/transaction-detail/${transactionId}?tenantId=${tenantId}`,
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction Detail data: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to fetch Transaction Detail data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionOverviewUIData(transactionId: number, tenantId = 'DEFAULT') {
    try {
      this.logger.log(`Fetching Transaction Overview UI data for transaction: ${transactionId}`);

      const response = await this.runSqlQuery(
        `
      SELECT *
      FROM transaction_detail
      WHERE transaction_id = ${transactionId}
        AND tenant_id = '${tenantId}'
      LIMIT 1
      `,
        1,
      );

      const rowRaw = response?.data?.[0];
      if (!rowRaw) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      const row = this.stripHudiMetadata(rowRaw);

      const mapField = (field: string): string | null | number => {
        if (!(field in row)) {
          return 'no mapping found';
        }
        return row[field] === null ? null : row[field];
      };

      return {
        transactionOverview: {
          transactionId: mapField('transaction_id'),
          timestamp: mapField('tx_event_ts'),
          type: mapField('tx_type'),
          status: 'no mapping found',
        },

        transactionFlow: {
          amount: mapField('interbank_settlement_amount'),
          currency: mapField('interbank_settlement_currency'),

          debtor: {
            name: mapField('debtor_name'),
            account: mapField('debtor_account_id'),
            bank: mapField('instd_mmb_id'),
          },

          creditor: {
            name: mapField('creditor_name'),
            account: mapField('creditor_account_id'),
            bank: mapField('instg_mmb_id'),
          },
        },

        debtorProfile: {
          name: mapField('debtor_name'),
          accountNumber: mapField('debtor_account_id'),
          accountType: 'no mapping found',
          bank: mapField('instg_mmb_id'),
          swiftCode: 'no mapping found',
          address: 'no mapping found',
        },

        creditorProfile: {
          name: mapField('creditor_name'),
          accountNumber: mapField('creditor_account_id'),
          accountType: 'no mapping found',
          bank: mapField('instd_mmb_id'),
          swiftCode: 'no mapping found',
          address: 'no mapping found',
        },

        amountAndCurrency: {
          originalAmount: mapField('instructed_amount'),
          originalCurrency: mapField('instructed_currency'),
          exchangeRate: mapField('exchange_rate'),
          convertedAmount: 'no mapping found',
        },

        charges: {
          senderCharges: 'no mapping found',
          intermediaryCharges: 'no mapping found',
          receiverCharges: 'no mapping found',
          totalCharges: mapField('charge_total_amount'),
          chargeCurrency: mapField('charge_currency'),
        },

        settlementDetails: {
          transactionTimestamp: mapField('tx_event_ts'),
          settlementDate: mapField('tx_event_date'),
          reference: 'no mapping found',
          purpose: 'no mapping found',
        },

        meta: {
          transactionId,
          tenantId,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error building Transaction Overview UI data: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to fetch Transaction Overview data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Given an arbitrary identifier (transaction id, end-to-end id, entity id, or account id),
   * return the list of account ids that should be used when fetching conditions.
   *
   * - Numeric string     -> look up transaction_detail.transaction_id
   * - UUID string        -> look up transaction_detail.end_to_end_id
   * - Entity ID (exists in account_holder.source) -> resolve to multiple accounts
   * - Account ID (no entity mapping) -> use directly as single account
   */
  private async resolveToAccounts(id: string, tenantId: string): Promise<string[]> {
    // numeric transaction id?
    if (/^\d + $ /.test(id)) {
      const resp = await this.query({
        table_name: 'transaction_detail',
        filters: { transaction_id: parseInt(id, 10), tenant_id: tenantId },
        columns: ['debtor_account_id', 'creditor_account_id'],
      });
      const row = resp.data?.[0] || {};
      return [row.debtor_account_id, row.creditor_account_id].filter(Boolean) as string[];
    }

    // uuid end-to-end id?
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
    if (uuidRegex.test(id)) {
      const resp = await this.query({
        table_name: 'transaction_detail',
        filters: { end_to_end_id: id, tenant_id: tenantId },
        columns: ['debtor_account_id', 'creditor_account_id'],
      });
      const row = resp.data?.[0] || {};
      return [row.debtor_account_id, row.creditor_account_id].filter(Boolean) as string[];
    }

    // Try to resolve as entity ID (entity → multiple accounts)
    const resp = await this.query({
      table_name: 'account_holder',
      filters: { source: id, tenant_id: tenantId },
      columns: ['destination'],
    });
    const accts = (resp.data?.map((r) => r.destination).filter(Boolean) || []) as string[];

    // If entity lookup returned accounts, use those (entity-level query)
    if (accts.length > 0) {
      return Array.from(new Set(accts));
    }

    // Otherwise, treat the ID as a direct account ID (account-level query)
    // This handles cases where account IDs are passed directly without entity mapping
    return [id];
  }

  /**
   * Get all accounts associated with an entity ID
   */
  async getEntityAccounts(
    entityId: string,
    tenantId: string,
  ): Promise<{
    entityId: string;
    accountCount: number;
    accounts: unknown[];
    tenantId: string;
  }> {
    try {
      const resp = await this.query({
        table_name: 'account_holder',
        filters: { source: entityId, tenant_id: tenantId },
        columns: ['destination', 'account_id'],
      });

      const accounts = resp.data?.map((r) => r.destination ?? r.account_id).filter(Boolean) || [];
      const uniqueAccounts = Array.from(new Set(accounts));

      return {
        entityId,
        accountCount: uniqueAccounts.length,
        accounts: uniqueAccounts,
        tenantId,
      };
    } catch (error) {
      this.logger.error(`Error fetching entity accounts for ${entityId}`, error.stack);
      return {
        entityId,
        accountCount: 0,
        accounts: [],
        tenantId,
      };
    }
  }

  async getConditionsSummary(identifier: string, tenantId?: string, fromDate?: string) {
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
      const isNumeric = /^\d+$/.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier);
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

  async getConditionsList(identifier: string, tenantId?: string) {
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

      const rows = response.data || [];

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
      this.logger.error('Error fetching conditions list', error.stack);
      throw new HttpException('Failed to fetch conditions list', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getActiveConditions(identifier: string, tenantId = 'DEFAULT', fromDate?: string) {
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
      const isNumeric = /^\d+$/.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier);
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
      this.logger.error('Error fetching active conditions', error.stack);
      throw new HttpException('Failed to fetch active conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExpiredConditions(identifier: string, tenantId = 'DEFAULT') {
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

      // Query conditions_timeline with LEFT JOIN to transaction_detail
      // to show transactions that occurred during condition period
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
      const isNumeric = /^\d+$/.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier);
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
      this.logger.error('Error fetching expired conditions', error.stack);
      throw new HttpException('Failed to fetch expired conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFutureConditions(identifier: string, tenantId = 'DEFAULT') {
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

      // Query conditions_timeline for future conditions
      // Note: Future conditions won't have transactions yet, but we keep the structure consistent
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
      const isNumeric = /^\d+$/.test(identifier);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier);
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
      this.logger.error('Error fetching future conditions', error.stack);
      throw new HttpException('Failed to fetch future conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvaluatedTransactions(identifier: string, tenantId = 'DEFAULT', fromDate?: string) {
    try {
      const accounts = await this.resolveToAccounts(identifier, tenantId);
      if (accounts.length === 0) {
        return [];
      }

      const accountFilter = accounts.map((a) => `'${a}'`).join(',');
      const dateFilter = fromDate ? `AND ct.cond_inception_ts >= '${fromDate}'` : '';

      // WORKAROUND: Since conditions_timeline.tx_transaction_id is null,
      // we JOIN with transaction_detail to find transactions that occurred
      // during the condition's active period (inception to expiry)
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
      this.logger.error('Error fetching evaluated transactions', error.stack);
      throw new HttpException('Failed to fetch evaluated transactions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private stripHudiMetadata(record: Record<string, any>): Record<string, any> {
    const hudiFields = ['_hoodie_commit_time', '_hoodie_commit_seqno', '_hoodie_record_key', '_hoodie_partition_path', '_hoodie_file_name'];

    const cleaned = { ...record };
    hudiFields.forEach((field) => delete cleaned[field]);
    return cleaned;
  }

  async getTransactionHistoryData(
    id: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<unknown> {
    try {
      // Smart detection: Check if ID is a UUID (end_to_end_id) or entity_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iv;
      const isEndToEndId = uuidRegex.test(id);

      if (isEndToEndId) {
        // Query by end_to_end_id - returns all 4 entity perspectives for single transaction
        this.logger.log(`Fetching Transaction History by end_to_end_id: ${id}`);
        return await this.getTransactionHistoryByEndToEndId(id, tenantId, startDate, endDate, granularity);
      } else {
        // Query by entity_id - returns transaction history for entity
        this.logger.log(`Fetching Transaction History by entity_id: ${id}`);
        return await this.getTransactionHistoryByEntityId(id, tenantId, startDate, endDate, granularity);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction History data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Transaction History data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async getTransactionHistoryByEntityId(
    entityId: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<{
    summary: {
      totalVolume: number;
      totalTransactions: number;
      transactionCount: number;
      alertsTriggered: number;
      alertsPercentage: number;
      investigated: number;
      investigatedPercentage: number;
      avgTransactionsPerDay: number;
      durationDays: number;
      bucketTotalVolume: number;
      bucketTotalTransactions: number;
      expected: {
        transactionCount: number | null;
        volume: number | null;
      };
      actual: {
        transactionCount: number;
        volume: number;
      };
    };
    timeline: Timeline[];
    cumulative: Cumulative;
    volumeDistribution: Array<{
      bucketStart: string;
      granularity: string;
      transactionCount: number;
      totalVolume: number;
    }>;
    recentTransactions: RecentTransaction[];
    meta: {
      entityId: string;
      tenantId: string;
      granularity: string | null;
      startDate: string | null;
      endDate: string | null;
      eventRowCount: number;
      aggRowCount: number;
      queryTimestamp: string;
    };
  }> {
    try {
      this.logger.log(`Fetching Transaction History for entity: ${entityId}`);

      // Build date filter if provided
      const dateFilter = startDate && endDate ? `AND th.event_date BETWEEN '${startDate}' AND '${endDate}'` : '';

      // Query 1: Fetch EVENT rows with transaction details
      const eventsResponse = await this.runSqlQuery(
        `
        SELECT 
          th.transaction_id,
          th.event_date,
          th.tx_amount,
          th.tx_ccy,
          th.tx_type,
          th.is_alerted,
          th.is_investigated,
          th.cum_tx_count,
          th.cum_tx_amount,
          th.entity_role,
          td.debtor_name,
          td.creditor_name
        FROM transaction_history th
        LEFT JOIN transaction_detail td 
          ON th.transaction_id = td.transaction_id 
          AND th.tenant_id = td.tenant_id
        WHERE th.row_type = 'EVENT'
          AND th.entity_id = '${entityId}'
          AND th.tenant_id = '${tenantId}'
          ${dateFilter}
        ORDER BY th.event_date DESC
        `,
        1000,
      );

      // Query 2: Fetch AGG rows for volume distribution (if granularity provided)
      let aggregates: any[] = [];
      if (granularity) {
        const aggDateFilter = startDate && endDate ? `AND bucket_start BETWEEN '${startDate}' AND '${endDate}'` : '';

        const aggResponse = await this.runSqlQuery(
          `
          SELECT 
            bucket_start,
            bucket_tx_count,
            bucket_tx_amount,
            bucket_granularity
          FROM transaction_history
          WHERE row_type = 'AGG'
            AND entity_id = '${entityId}'
            AND bucket_granularity = '${granularity}'
            AND tenant_id = '${tenantId}'
            ${aggDateFilter}
          ORDER BY bucket_start ASC
          `,
          1000,
        );
        aggregates = (aggResponse?.data ?? []).map((a) => this.stripHudiMetadata(a));
      }

      const events = (eventsResponse?.data ?? []).map((e) => this.stripHudiMetadata(e));

      if (events.length === 0) {
        this.logger.warn(`No transaction history found for entity: ${entityId}`);
      }

      // Query 3: Fetch baseline data from counterparty_account_links for expected metrics
      let expectedTxCount: number | null = null;
      let expectedVolume: number | null = null;
      try {
        const baselineResponse = await this.runSqlQuery(
          `
          SELECT 
            SUM(tx_count) as total_tx_count,
            SUM(total_amount) as total_amount
          FROM counterparty_account_links
          WHERE account_id = '${entityId}'
            AND tenant_id = '${tenantId}'
          `,
          100,
        );
        const baseline = baselineResponse?.data?.[0];
        if (baseline) {
          const baselineData = this.stripHudiMetadata(baseline);
          expectedTxCount = parseInt(baselineData.total_tx_count, 10) || null;
          expectedVolume = parseFloat(baselineData.total_amount) || null;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch baseline data for entity: ${entityId}`);
      }

      // Calculate summary statistics
      const totalTransactions = events.length;
      const totalVolume = events.reduce((sum, e) => sum + (parseFloat(e.tx_amount) || 0), 0);
      const alertsTriggered = events.filter((e) => e.is_alerted === 1).length;
      const investigated = events.filter((e) => e.is_investigated === 1).length;

      // Calculate time range
      let durationDays = 30; // default
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else if (events.length > 0) {
        // Calculate from actual data
        const dates = events.map((e) => new Date(e.event_date).getTime()).sort();
        durationDays = Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Calculate aggregates from bucket data
      const bucketTotalVolume = aggregates.reduce((sum, a) => sum + (parseFloat(a.bucket_tx_amount) || 0), 0);
      const bucketTotalTransactions = aggregates.reduce((sum, a) => sum + (parseInt(a.bucket_tx_count) || 0), 0);

      // Calculate percentages and averages
      const alertsPercentage = totalTransactions > 0 ? (alertsTriggered / totalTransactions) * 100 : 0;
      const investigatedPercentage = totalTransactions > 0 ? (investigated / totalTransactions) * 100 : 0;
      const avgTransactionsPerDay = durationDays > 0 ? totalTransactions / durationDays : 0;

      // Transform timeline data with cumulative values
      const timeline = events.map((e) => ({
        transactionId: e.transaction_id,
        date: e.event_date,
        amount: parseFloat(e.tx_amount) || 0,
        currency: e.tx_ccy,
        type: e.tx_type ?? 'Unknown',
        isAlerted: e.is_alerted === 1,
        isInvestigated: e.is_investigated === 1,
      }));

      // Transform cumulative data (sorted by date ascending)
      const cumulative = events
        .map((e) => ({
          date: e.event_date,
          cumulativeAmount: parseFloat(e.cum_tx_amount) || 0,
          cumulativeCount: parseInt(e.cum_tx_count) || 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Transform volume distribution
      const volumeDistribution = aggregates.map((a) => ({
        bucketStart: a.bucket_start,
        granularity: a.bucket_granularity,
        transactionCount: parseInt(a.bucket_tx_count) || 0,
        totalVolume: parseFloat(a.bucket_tx_amount) || 0,
      }));

      // Transform recent transactions table (top 20)
      const recentTransactions = events.slice(0, 20).map((e) => {
        // Determine counterparty based on entity role
        const counterparty = e.entity_role === 'DEBTOR' ? (e.creditor_name ?? 'Unknown Creditor') : (e.debtor_name ?? 'Unknown Debtor');

        const status: string[] = [];
        if (e.is_alerted === 1) status.push('Alert');
        if (e.is_investigated === 1) status.push('Investigated');

        return {
          transactionId: e.transaction_id,
          date: e.event_date,
          type: e.tx_type ?? 'Unknown',
          counterparty,
          amount: parseFloat(e.tx_amount) || 0,
          currency: e.tx_ccy,
          status,
          actions: {
            viewDetailsLink: `/triage/transaction-detail/${e.transaction_id}`,
          },
        };
      });

      return {
        summary: {
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalTransactions,
          transactionCount: totalTransactions,
          alertsTriggered,
          alertsPercentage: Math.round(alertsPercentage * 100) / 100,
          investigated,
          investigatedPercentage: Math.round(investigatedPercentage * 100) / 100,
          avgTransactionsPerDay: Math.round(avgTransactionsPerDay * 100) / 100,
          durationDays,
          bucketTotalVolume: Math.round(bucketTotalVolume * 100) / 100,
          bucketTotalTransactions,
          expected: {
            transactionCount: expectedTxCount,
            volume: expectedVolume ? Math.round(expectedVolume * 100) / 100 : null,
          },
          actual: {
            transactionCount: totalTransactions,
            volume: Math.round(totalVolume * 100) / 100,
          },
        },
        timeline,
        cumulative,
        volumeDistribution,
        recentTransactions,
        meta: {
          entityId,
          tenantId,
          granularity: granularity ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          eventRowCount: events.length,
          aggRowCount: aggregates.length,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching Transaction History by entity_id: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch Transaction History by entity_id', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionHistoryByEndToEndId(
    endToEndId: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ) {
    try {
      this.logger.log(`Fetching Transaction History for end_to_end_id: ${endToEndId}`);

      // Build date filter if provided (though typically not used with end_to_end_id queries)
      const dateFilter = startDate && endDate ? `AND th.event_date BETWEEN '${startDate}' AND '${endDate}'` : '';

      // Query transaction_history for all entity perspectives with row_type='EVENT'
      const eventsResponse = await this.runSqlQuery(
        `
        SELECT 
          th.transaction_id,
          th.end_to_end_id,
          th.entity_type,
          th.entity_role,
          th.entity_id,
          th.entity_name,
          th.event_date,
          th.event_ts,
          th.tx_amount,
          th.tx_ccy,
          th.tx_type,
          th.is_alerted,
          th.is_investigated,
          td.debtor_name,
          td.creditor_name,
          td.debtor_account_id,
          td.creditor_account_id
        FROM transaction_history th
        LEFT JOIN transaction_detail td 
          ON th.transaction_id = td.transaction_id 
          AND th.tenant_id = td.tenant_id
        WHERE th.row_type = 'EVENT'
          AND th.end_to_end_id = '${endToEndId}'
          AND th.tenant_id = '${tenantId}'
          ${dateFilter}
        ORDER BY th.entity_type, th.entity_role
        `,
        10,
      );

      const events = (eventsResponse?.data ?? []).map((e) => this.stripHudiMetadata(e));

      if (events.length === 0) {
        this.logger.warn(`No transaction found for end_to_end_id: ${endToEndId}`);
        return {
          summary: {
            totalVolume: 0,
            totalTransactions: 0,
            transactionCount: 0,
            alertsTriggered: 0,
            alertsPercentage: 0,
            investigated: 0,
            investigatedPercentage: 0,
            avgTransactionsPerDay: 0,
            durationDays: 0,
          },
          timeline: [],
          cumulative: [],
          volumeDistribution: [],
          recentTransactions: [],
          entityPerspectives: [],
          meta: {
            endToEndId,
            tenantId,
            queryType: 'end_to_end_id',
            message: 'No transaction found with this end_to_end_id',
            queryTimestamp: new Date().toISOString(),
          },
        };
      }

      // Build entity perspectives array (using snake_case to match database schema)
      const entityPerspectives = events.map((e) => ({
        entity_type: e.entity_type,
        entity_role: e.entity_role,
        entity_id: e.entity_id,
        entity_name: e.entity_name ?? 'Unknown Entity',
        transaction_id: e.transaction_id,
        tx_amount: parseFloat(e.tx_amount) || 0,
        tx_ccy: e.tx_ccy,
        event_ts: e.event_ts,
      }));

      // Process all events to build summary metrics
      let totalVolume = 0;
      let alertsTriggered = 0;
      let investigatedCount = 0;

      const timeline = events.map((e) => {
        const amount = parseFloat(e.tx_amount) || 0;
        const isAlert = e.is_alerted === 1;
        const isInvest = e.is_investigated === 1;

        totalVolume += amount;
        if (isAlert) alertsTriggered += 1;
        if (isInvest) investigatedCount += 1;

        return {
          transactionId: e.transaction_id,
          date: e.event_ts,
          amount,
          currency: e.tx_ccy,
          type: e.tx_type ?? 'Unknown',
          isAlerted: isAlert,
          isInvestigated: isInvest,
          entityRole: e.entity_role,
          entityType: e.entity_type,
        };
      });

      // Build cumulative data
      let runningAmount = 0;
      const cumulative = events.map((e, index) => {
        const amount = parseFloat(e.tx_amount) || 0;
        runningAmount += amount;
        return {
          date: e.event_ts,
          cumulativeAmount: runningAmount,
          cumulativeCount: index + 1,
        };
      });

      // Build recent transactions table with all perspectives
      const recentTransactions = events.map((e) => {
        const amount = parseFloat(e.tx_amount) || 0;
        const isAlert = e.is_alerted === 1;
        const isInvest = e.is_investigated === 1;

        return {
          transactionId: e.transaction_id,
          date: e.event_ts,
          type: e.tx_type ?? 'Unknown',
          counterparty: e.entity_name ?? 'Unknown',
          role: `${e.entity_type} (${e.entity_role})`,
          amount,
          currency: e.tx_ccy,
          status: [...(isAlert ? ['Alert'] : []), ...(isInvest ? ['Investigated'] : [])],
          actions: {
            viewDetailsLink: `/triage/transaction-detail/${e.transaction_id}`,
          },
        };
      });

      const firstEvent = events[0];

      return {
        summary: {
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalTransactions: events.length,
          transactionCount: events.length,
          alertsTriggered,
          alertsPercentage: (alertsTriggered / events.length) * 100,
          investigated: investigatedCount,
          investigatedPercentage: (investigatedCount / events.length) * 100,
          avgTransactionsPerDay: events.length, // Since it's one day effectively
          durationDays: 1,
          perspectiveCount: events.length,
        },
        timeline,
        cumulative,
        volumeDistribution: [],
        recentTransactions,
        entityPerspectives,
        meta: {
          endToEndId,
          tenantId,
          queryType: 'end_to_end_id',
          transactionId: firstEvent.transaction_id,
          perspectiveCount: events.length,
          debtorName: firstEvent.debtor_name,
          creditorName: firstEvent.creditor_name,
          debtorAccountId: firstEvent.debtor_account_id,
          creditorAccountId: firstEvent.creditor_account_id,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction History by end_to_end_id (${endToEndId}): ${errorMessage}`, errorStack);

      // Log additional context for debugging
      this.logger.error(`Query parameters - tenantId: ${tenantId}, startDate: ${startDate}, endDate: ${endDate}`);

      throw new HttpException(`Failed to fetch Transaction History by end_to_end_id: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionPerspectivesByEndToEndId(endToEndId: string, tenantId = 'DEFAULT') {
    try {
      this.logger.log(`Fetching Transaction Perspectives for end_to_end_id: ${endToEndId}`);

      // Query transaction_history for all entity perspectives with row_type='EVENT'
      const response = await this.runSqlQuery(
        `
        SELECT 
          th.entity_type,
          th.entity_role,
          th.entity_id,
          th.entity_name,
          th.transaction_id,
          th.end_to_end_id,
          th.tx_amount,
          th.tx_ccy,
          th.tx_type,
          th.event_date,
          th.event_ts,
          th.is_alerted,
          th.is_investigated,
          td.debtor_name,
          td.creditor_name,
          td.debtor_account_id,
          td.creditor_account_id
        FROM transaction_history th
        LEFT JOIN transaction_detail td 
          ON th.transaction_id = td.transaction_id 
          AND th.tenant_id = td.tenant_id
        WHERE th.row_type = 'EVENT'
          AND th.end_to_end_id = '${endToEndId}'
          AND th.tenant_id = '${tenantId}'
        ORDER BY th.entity_type, th.entity_role
        `,
        10,
      );

      const perspectives = (response?.data ?? []).map((row) => this.stripHudiMetadata(row));

      if (perspectives.length === 0) {
        this.logger.warn(`No transaction perspectives found for end_to_end_id: ${endToEndId}`);
        return {
          endToEndId,
          tenantId,
          perspectives: [],
          perspectiveCount: 0,
          transactionDetails: null,
          meta: {
            queryTimestamp: new Date().toISOString(),
            message: 'No transaction found with this end_to_end_id',
          },
        };
      }

      // Extract common transaction details from first perspective
      const firstPerspective = perspectives[0];
      const transactionDetails = {
        transactionId: firstPerspective.transaction_id,
        endToEndId: firstPerspective.end_to_end_id,
        amount: parseFloat(firstPerspective.tx_amount) || 0,
        currency: firstPerspective.tx_ccy,
        type: firstPerspective.tx_type ?? 'Unknown',
        date: firstPerspective.event_date,
        timestamp: firstPerspective.event_ts,
        isAlerted: firstPerspective.is_alerted === 1,
        isInvestigated: firstPerspective.is_investigated === 1,
        debtorName: firstPerspective.debtor_name,
        creditorName: firstPerspective.creditor_name,
        debtorAccountId: firstPerspective.debtor_account_id,
        creditorAccountId: firstPerspective.creditor_account_id,
      };

      // Transform perspectives array (using snake_case to match database schema)
      const entityPerspectives = perspectives.map((p) => ({
        entity_type: p.entity_type,
        entity_role: p.entity_role,
        entity_id: p.entity_id,
        entity_name: p.entity_name ?? 'Unknown Entity',
        transaction_id: p.transaction_id,
        tx_amount: parseFloat(p.tx_amount) || 0,
        tx_ccy: p.tx_ccy,
        event_ts: p.event_ts,
      }));

      return {
        endToEndId,
        tenantId,
        perspectiveCount: perspectives.length,
        transactionDetails,
        perspectives: entityPerspectives,
        meta: {
          queryTimestamp: new Date().toISOString(),
          message: `Retrieved ${perspectives.length} entity perspective(s) for transaction`,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching Transaction Perspectives by end_to_end_id: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch Transaction Perspectives', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // private mapTransactionType(txType: string): string {
  //   // Return raw transaction type code (e.g., 'pacs.008.001.10')
  //   return txType || 'Unknown';
  // }

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
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const sql = `
      SELECT
        COUNT(DISTINCT a.alert_id) as total_alerts,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) as cases_opened,
        COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) as investigations,
        COUNT(DISTINCT t.task_id) FILTER (WHERE t.task_type LIKE '%SAR_STR_FILING%') as sar_filings,
        COALESCE(SUM(td.instructed_amount), 0) as total_value
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id
      LEFT JOIN tasks t ON c.case_id = t.case_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response.data?.[0] ?? {};

      return {
        totalAlerts: Number(row.total_alerts ?? 0),
        casesOpened: Number(row.cases_opened ?? 0),
        investigations: Number(row.investigations ?? 0),
        sarFilings: Number(row.sar_filings ?? 0),
        totalValue: parseFloat(row.total_value) || 0,
      };
    } catch (error) {
      this.logger.error('Error fetching alert history summary', error.stack);
      throw new HttpException('Failed to fetch alert history summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertHistoryTimeline(endToEndId?: string, tenantId?: string, dateRange?: string, granularity = 'day') {
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const sql = `
      SELECT
        DATE_TRUNC('${granularity}', a.created_at_ts) as date,
        COUNT(DISTINCT a.alert_id) as alert_count,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) as case_count,
        COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) as investigation_count,
        COALESCE(SUM(td.instructed_amount), 0) as total_value
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      GROUP BY DATE_TRUNC('${granularity}', a.created_at_ts)
      ORDER BY date ASC
      `;

      const response = await this.runSqlQuery(sql, 1000);
      const rows = response.data ?? [];

      const alertCountOverTime = rows.map((r) => ({
        date: r.date,
        alerts: Number(r.alert_count ?? 0),
        cases: Number(r.case_count ?? 0),
        investigations: Number(r.investigation_count ?? 0),
      }));

      const alertValueOverTime = rows.map((r) => ({
        date: r.date,
        totalValue: parseFloat(r.total_value) || 0,
      }));

      return {
        alertCountOverTime,
        alertValueOverTime,
      };
    } catch (error) {
      this.logger.error('Error fetching alert history timeline', error.stack);
      throw new HttpException('Failed to fetch alert history timeline', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertHistoryAlerts(endToEndId?: string, tenantId?: string, dateRange?: string, page = 1, limit = 20) {
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const offset = (page - 1) * limit;

      const countSql = `
      SELECT COUNT(DISTINCT a.alert_id) as total
      FROM alerts a
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      `;

      const countResponse = await this.runSqlQuery(countSql, 1);
      const total = Number(countResponse.data?.[0]?.total ?? 0);

      const sql = `
      SELECT DISTINCT
        a.alert_id,
        a.created_at_ts as date,
        a.alert_type_norm as type,
        a.priority_norm as severity,
        a.alert_status as status,
        a.case_id,
        c.status as case_status,
        a.evaluation_id
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      ORDER BY date DESC
      LIMIT ${limit} OFFSET ${offset}
      `;

      const response = await this.runSqlQuery(sql, limit);
      const rows = response.data ?? [];

      const alerts = rows.map((r) => {
        let outcome = 'Pending';
        if (r.case_status) {
          if (r.case_status.includes('COMPLETED')) outcome = 'Closed';
          else if (r.case_status.includes('DRAFT')) outcome = 'Draft';
          else if (r.case_status.includes('ASSIGNED') ?? r.case_status.includes('PROGRESS')) outcome = 'Investigating';
        }

        return {
          alertId: r.alert_id,
          date: r.date,
          type: r.type ?? 'Unknown',
          severity: r.severity ?? 'Unknown',
          status: r.status ?? 'Unknown',
          caseId: r.case_id ?? null,
          outcome,
          actions: {
            viewAlertNavigator: `/alert-navigator/${r.alert_id}`,
            viewTransactionDetails: r.evaluation_id ? `/transaction-detail/${r.evaluation_id}` : null,
          },
        };
      });

      return {
        alerts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching alert history alerts', error.stack);
      throw new HttpException('Failed to fetch alert history alerts', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTestAccountIds(tenantId = 'DEFAULT', minConnections = 1) {
    try {
      this.logger.log(`Fetching test account IDs from lakehouse (minConnections: ${minConnections})`);

      const sql = `
        WITH account_stats AS (
          SELECT 
            debtor_account_id as account_id,
            debtor_name as account_name,
            COUNT(DISTINCT creditor_account_id) as connections,
            COUNT(*) as total_transactions
          FROM transaction_detail
          WHERE tenant_id = '${tenantId}'
            AND debtor_account_id IS NOT NULL
            AND creditor_account_id IS NOT NULL
          GROUP BY debtor_account_id, debtor_name
          HAVING COUNT(DISTINCT creditor_account_id) >= ${minConnections}
          ORDER BY total_transactions DESC
          LIMIT 10
        )
        SELECT 
          account_id,
          account_name,
          connections,
          total_transactions
        FROM account_stats
      `;

      const response = await this.runSqlQuery(sql, 10);
      const accounts = (response?.data ?? []).map((row) => this.stripHudiMetadata(row));

      return {
        message: 'Test account IDs with network activity',
        tenantId,
        accounts: accounts.map((acc) => ({
          accountId: acc.account_id,
          accountName: acc.account_name,
          connections: Number(acc.connections),
          totalTransactions: Number(acc.total_transactions),
          testUrl: `/api/v1/lakehouse/network-analysis/transaction/${acc.account_id}?timeRange=30d`,
        })),
      };
    } catch (error) {
      this.logger.error(`Error fetching test account IDs: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch test account IDs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionNetworkData(accountId: string, tenantId = 'DEFAULT', timeRange = '30d'): Promise<TransactionNetworkResponseDto> {
    try {
      this.logger.log(`Fetching transaction network for account: ${accountId}, timeRange: ${timeRange}`);

      // const startDate = this.calculateStartDate(timeRange);

      const centerAccountSql = `
        SELECT DISTINCT 
          COALESCE(debtor_account_id, creditor_account_id) as account_id,
          COALESCE(debtor_name, creditor_name) as account_name
        FROM transaction_detail
        WHERE (debtor_account_id = '${accountId}' OR creditor_account_id = '${accountId}')
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const centerAccountResponse = await this.runSqlQuery(centerAccountSql, 1);
      const centerAccountRow = centerAccountResponse?.data?.[0];

      if (!centerAccountRow) {
        throw new HttpException('Account not found in transaction data', HttpStatus.NOT_FOUND);
      }

      const centerAccountInfo = this.stripHudiMetadata(centerAccountRow);

      const outboundSql = `
        SELECT 
          creditor_account_id as connected_account_id,
          creditor_name as connected_account_name,
          'OUTBOUND' as flow_direction,
          COUNT(transaction_id) as total_transactions,
          SUM(interbank_settlement_amount) as total_value,
          AVG(interbank_settlement_amount) as avg_value,
          MIN(tx_event_ts) as first_tx_date,
          MAX(tx_event_ts) as last_tx_date
        FROM transaction_detail
        WHERE debtor_account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
        GROUP BY creditor_account_id, creditor_name
      `;

      const inboundSql = `
        SELECT 
          debtor_account_id as connected_account_id,
          debtor_name as connected_account_name,
          'INBOUND' as flow_direction,
          COUNT(transaction_id) as total_transactions,
          SUM(interbank_settlement_amount) as total_value,
          AVG(interbank_settlement_amount) as avg_value,
          MIN(tx_event_ts) as first_tx_date,
          MAX(tx_event_ts) as last_tx_date
        FROM transaction_detail
        WHERE creditor_account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
        GROUP BY debtor_account_id, debtor_name
      `;

      const alertFlagsSql = `
        SELECT DISTINCT '${accountId}' as account_id WHERE 1=0
      `;

      const [outboundResponse, inboundResponse, alertFlagsResponse] = await Promise.all([
        this.runSqlQuery(outboundSql, 1000),
        this.runSqlQuery(inboundSql, 1000),
        this.runSqlQuery(alertFlagsSql, 10),
      ]);

      const outboundData = (outboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const inboundData = (inboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const alertFlags = new Set((alertFlagsResponse?.data ?? []).map((row) => this.stripHudiMetadata(row).account_id));

      const allConnections = [...outboundData, ...inboundData];

      const connectedAccounts: ConnectedAccountDto[] = allConnections.map((conn) => {
        const velocity = this.calculateVelocity(Number(conn.total_transactions), Math.max(Number(conn.duration_days), 1));

        const hasAlert = alertFlags.has(conn.connected_account_id);

        const stats: TransactionStatsDto = {
          totalTransactions: Number(conn.total_transactions),
          totalValue: Math.round(Number(conn.total_value) * 100) / 100,
          averageValue: Math.round(Number(conn.avg_value) * 100) / 100,
          velocity,
        };

        return {
          accountId: conn.connected_account_id,
          accountHolder: conn.connected_account_name,
          flowDirection: conn.flow_direction === 'OUTBOUND' ? 'Outbound (Payments To)' : 'Inbound (Payments From)',
          transactionStats: stats,
          hasAlert,
          alertMessage: hasAlert ? 'Alert triggered on this account' : undefined,
          firstTransactionDate: conn.first_tx_date,
          lastTransactionDate: conn.last_tx_date,
        };
      });

      const edges: NetworkEdgeDto[] = allConnections.map((conn, index) => ({
        id: `edge-${index}`,
        source: conn.flow_direction === 'OUTBOUND' ? accountId : conn.connected_account_id,
        target: conn.flow_direction === 'OUTBOUND' ? conn.connected_account_id : accountId,
        type: conn.flow_direction.toLowerCase() as 'inbound' | 'outbound',
        transactionCount: Number(conn.total_transactions),
        totalValue: Math.round(Number(conn.total_value) * 100) / 100,
      }));

      const outboundCount = outboundData.length;
      const inboundCount = inboundData.length;
      const accountsWithAlerts = connectedAccounts.filter((acc) => acc.hasAlert).length;

      const networkSummary: NetworkSummaryDto = {
        connectedAccounts: connectedAccounts.length,
        outboundConnections: outboundCount,
        inboundConnections: inboundCount,
        accountsWithAlerts,
      };

      const centerAccount: CenterAccountDto = {
        accountId,
        accountHolder: centerAccountInfo.account_name,
        networkSummary,
      };

      return {
        centerAccount,
        connectedAccounts,
        edges,
        timeRange,
        tenantId,
        queryTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error fetching transaction network data: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch transaction network data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private calculateVelocity(totalTransactions: number, durationDays: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (durationDays === 0) return 'LOW';

    const txPerDay = totalTransactions / durationDays;

    if (txPerDay > 0.5) return 'HIGH';
    if (txPerDay >= 0.2) return 'MEDIUM';
    return 'LOW';
  }

  private calculateStartDate(timeRange: string): string {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case '30d':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case '90d':
        startDate = new Date(now.setDate(now.getDate() - 90));
        break;
      case '1y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'all':
        startDate = new Date('2000-01-01');
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 30));
    }

    return startDate.toISOString();
  }

  async getAccountNodeFullData(accountId: string, tenantId = 'DEFAULT', granularity: 'day' | 'month' | 'year' = 'month') {
    try {
      const networkSql = `
      SELECT
        from_account_id,
        to_account_id,
        tx_count,
        total_amount,
        currency_hint,
        first_event_ts,
        last_event_ts,
        is_alerted_edge,
        is_investigated_edge
      FROM tx_network_accounts_edges
      WHERE tenant_id = '${tenantId}'
        AND bucket_granularity = '${granularity}'
        AND (
          from_account_id = '${accountId}'
          OR to_account_id = '${accountId}'
        )
    `;

      const networkResp = await this.runSqlQuery(networkSql, 1000);
      const networkRows = (networkResp.data ?? []).map((r) => this.stripHudiMetadata(r));

      const nodesMap = new Map<string, any>();
      const edges: any[] = [];

      nodesMap.set(accountId, {
        id: accountId,
        type: 'ACCOUNT',
        label: accountId,
        flags: { alerted: false, investigated: false },
      });

      for (const r of networkRows) {
        const fromId = r.from_account_id;
        const toId = r.to_account_id;

        if (!nodesMap.has(fromId)) {
          nodesMap.set(fromId, {
            id: fromId,
            type: 'ACCOUNT',
            label: fromId,
            flags: {
              alerted: r.is_alerted_edge === 1,
              investigated: r.is_investigated_edge === 1,
            },
          });
        }

        if (!nodesMap.has(toId)) {
          nodesMap.set(toId, {
            id: toId,
            type: 'ACCOUNT',
            label: toId,
            flags: {
              alerted: r.is_alerted_edge === 1,
              investigated: r.is_investigated_edge === 1,
            },
          });
        }

        const root = nodesMap.get(accountId);
        root.flags.alerted ??= r.is_alerted_edge === 1;
        root.flags.investigated ??= r.is_investigated_edge === 1;

        edges.push({
          source: fromId,
          target: toId,
          txCount: Number(r.tx_count ?? 0),
          totalAmount: Number(r.total_amount ?? 0),
          currency: r.currency_hint,
          flags: {
            alerted: r.is_alerted_edge === 1,
            investigated: r.is_investigated_edge === 1,
          },
        });
      }

      const metricsSql = `
      SELECT
        SUM(tx_count) AS transactions,
        SUM(total_amount) AS total_value,
        MAX(is_alerted_edge) AS is_alerted,
        MAX(is_investigated_edge) AS is_investigated
      FROM tx_network_accounts_edges
      WHERE tenant_id = '${tenantId}'
        AND (
          from_account_id = '${accountId}'
          OR to_account_id = '${accountId}'
        )
    `;

      const metricsResp = await this.runSqlQuery(metricsSql, 1);
      const metrics = this.stripHudiMetadata(metricsResp.data?.[0] ?? {});

      const holderSql = `
      SELECT debtor_name AS holder_name
      FROM transaction_detail
      WHERE tenant_id = '${tenantId}'
        AND debtor_account_id = '${accountId}'
      LIMIT 1
    `;

      const holderResp = await this.runSqlQuery(holderSql, 1);
      const holderRow = holderResp.data?.[0];

      const alertSql = `
      SELECT COUNT(*) AS alert_count
      FROM alerts a
      JOIN transaction_detail td
        ON a.tx_original_e2e_id = td.end_to_end_id
      WHERE td.debtor_account_id = '${accountId}'
         OR td.creditor_account_id = '${accountId}'
    `;

      const investigationSql = `
      SELECT COUNT(*) AS investigation_count
      FROM cases c
      JOIN alerts a ON a.case_id = c.case_id
      JOIN transaction_detail td
        ON a.tx_original_e2e_id = td.end_to_end_id
      WHERE c.status NOT IN ('STATUS_00_DRAFT','STATUS_99_COMPLETED')
        AND (
          td.debtor_account_id = '${accountId}'
          OR td.creditor_account_id = '${accountId}'
        )
    `;

      const [alertResp, investigationResp] = await Promise.all([this.runSqlQuery(alertSql, 1), this.runSqlQuery(investigationSql, 1)]);

      const txCount = Number(metrics.transactions ?? 0);

      return {
        network: {
          rootNodeId: accountId,
          nodes: Array.from(nodesMap.values()),
          edges,
        },
        accountDetails: {
          accountId,
          accountHolder: holderRow?.holder_name ?? 'Unknown',
          relationship: 'Primary Owner',
          transactions: txCount,
          totalValue: Number(metrics.total_value ?? 0),
          velocity: txCount >= 50 ? 'HIGH' : txCount >= 10 ? 'MEDIUM' : 'LOW',
          flags: {
            alerted: metrics.is_alerted === 1 || Number(alertResp.data?.[0]?.alert_count ?? 0) > 0,
            investigated: metrics.is_investigated === 1 || Number(investigationResp.data?.[0]?.investigation_count ?? 0) > 0,
          },
        },
        meta: {
          tenantId,
          granularity,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching full account node data: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch account network and details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCounterpartyNodeFullData(counterpartyId: string, tenantId = 'DEFAULT', granularity: 'day' | 'month' | 'year' = 'month') {
    try {
      const networkSql = `
      SELECT
        from_counterparty_id,
        to_counterparty_id,
        tx_count,
        total_amount,
        currency_hint,
        first_event_ts,
        last_event_ts,
        is_alerted_edge,
        is_investigated_edge
      FROM tx_network_counterparties_edges
      WHERE tenant_id = '${tenantId}'
        AND bucket_granularity = '${granularity}'
        AND (
          from_counterparty_id = '${counterpartyId}'
          OR to_counterparty_id = '${counterpartyId}'
        )
    `;

      const networkResp = await this.runSqlQuery(networkSql, 1000);
      const networkRows = (networkResp.data ?? []).map((r) => this.stripHudiMetadata(r));

      const nodesMap = new Map<string, any>();
      const edges: any[] = [];

      nodesMap.set(counterpartyId, {
        id: counterpartyId,
        type: 'COUNTERPARTY',
        label: counterpartyId,
        flags: { alerted: false, investigated: false },
      });

      for (const r of networkRows) {
        const fromId = r.from_counterparty_id;
        const toId = r.to_counterparty_id;

        if (!nodesMap.has(fromId)) {
          nodesMap.set(fromId, {
            id: fromId,
            type: 'COUNTERPARTY',
            label: fromId,
            flags: {
              alerted: r.is_alerted_edge === 1,
              investigated: r.is_investigated_edge === 1,
            },
          });
        }

        if (!nodesMap.has(toId)) {
          nodesMap.set(toId, {
            id: toId,
            type: 'COUNTERPARTY',
            label: toId,
            flags: {
              alerted: r.is_alerted_edge === 1,
              investigated: r.is_investigated_edge === 1,
            },
          });
        }

        const root = nodesMap.get(counterpartyId);
        root.flags.alerted ??= r.is_alerted_edge === 1;
        root.flags.investigated ??= r.is_investigated_edge === 1;

        edges.push({
          source: fromId,
          target: toId,
          txCount: Number(r.tx_count ?? 0),
          totalAmount: Number(r.total_amount ?? 0),
          currency: r.currency_hint,
          flags: {
            alerted: r.is_alerted_edge === 1,
            investigated: r.is_investigated_edge === 1,
          },
        });
      }

      const metricsSql = `
      SELECT
        SUM(tx_count) AS transactions,
        SUM(total_amount) AS total_value,
        MAX(is_alerted_edge) AS is_alerted,
        MAX(is_investigated_edge) AS is_investigated
      FROM tx_network_counterparties_edges
      WHERE tenant_id = '${tenantId}'
        AND (
          from_counterparty_id = '${counterpartyId}'
          OR to_counterparty_id = '${counterpartyId}'
        )
    `;

      const metricsResp = await this.runSqlQuery(metricsSql, 1);
      const metrics = this.stripHudiMetadata(metricsResp.data?.[0] ?? {});

      // For Name, we search in transaction_detail by any account that links to this counterparty
      const nameSql = `
      SELECT DISTINCT debtor_name AS holder_name
      FROM transaction_detail td
      JOIN counterparty_account_links cal ON td.debtor_account_id = cal.account_id
      WHERE td.tenant_id = '${tenantId}'
        AND cal.counterparty_id = '${counterpartyId}'
      LIMIT 1
    `;

      const nameResp = await this.runSqlQuery(nameSql, 1);
      const nameRow = nameResp.data?.[0];

      const txCount = Number(metrics.transactions ?? 0);

      return {
        network: {
          rootNodeId: counterpartyId,
          nodes: Array.from(nodesMap.values()),
          edges,
        },
        counterpartyDetails: {
          counterpartyId,
          name: nameRow?.holder_name ?? counterpartyId,
          type: 'Business',
          transactions: txCount,
          totalValue: Number(metrics.total_value ?? 0),
          velocity: txCount >= 50 ? 'HIGH' : txCount >= 10 ? 'MEDIUM' : 'LOW',
          flags: {
            alerted: metrics.is_alerted === 1,
            investigated: metrics.is_investigated === 1,
          },
        },
        meta: {
          tenantId,
          granularity,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Error in getCounterpartyNodeFullData: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch counterparty network details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getBenfordAnalysisByAccount(
    accountId: string,
    tenantId: string,
    fromDate: string,
    toDate: string,
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
    try {
      this.logger.log(`Running Benford analysis for account ${accountId}, tenant ${tenantId}, range ${fromDate} → ${toDate}`);

      const sql = `
      SELECT
        ABS(interbank_settlement_amount) AS amount
      FROM transaction_detail
      WHERE tenant_id = '${tenantId}'
        AND interbank_settlement_amount IS NOT NULL
        AND interbank_settlement_amount > 0
        AND (
          debtor_account_id = '${accountId}'
          OR creditor_account_id = '${accountId}'
        )
        AND tx_event_date BETWEEN '${fromDate}' AND '${toDate}'
    `;

      const response = await this.runSqlQuery(sql, 100000);
      const rows = response?.data ?? [];

      const amounts: number[] = rows.map((r) => Number(r.amount)).filter((v) => !isNaN(v) && v > 0);

      const expected: Record<number, number> = {};
      for (let d = 1; d <= 9; d += 1) {
        expected[d] = Math.log10(1 + 1 / d);
      }

      const counts = Array(10).fill(0);
      let total = 0;

      for (const value of amounts) {
        const s = value.toString().replace('.', '').replace(/^0+/, '');
        if (!s) continue;

        const digit = parseInt(s[0], 10);
        if (digit >= 1 && digit <= 9) {
          counts[digit]++;
          total += 1;
        }
      }

      const actual: Record<number, number> = {};
      for (let d = 1; d <= 9; d += 1) {
        actual[d] = total > 0 ? counts[d] / total : 0;
      }

      return {
        expected,
        actual,
        sampleSize: total,
        meta: {
          accountId,
          tenantId,
          fromDate,
          toDate,
        },
      };
    } catch (error) {
      this.logger.error(`Error running Benford analysis for account ${accountId}: ${error.message}`, error.stack);

      throw new HttpException('Failed to perform Benford analysis', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCounterpartyNetworkData(accountId: string, tenantId = 'DEFAULT', timeRange = '30d'): Promise<CounterpartyNetworkResponseDto> {
    try {
      this.logger.log(`Fetching counterparty network for account: ${accountId}`);

      const accountHolderSql = `
        SELECT 
          debtor_name,
          creditor_name,
          debtor_account_id,
          creditor_account_id
        FROM transaction_detail
        WHERE (debtor_account_id = '${accountId}' OR creditor_account_id = '${accountId}')
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const accountHolderResponse = await this.runSqlQuery(accountHolderSql, 1);
      const accountRow = accountHolderResponse?.data?.[0];

      if (!accountRow) {
        throw new HttpException('Account not found in transactions', HttpStatus.NOT_FOUND);
      }

      const account = this.stripHudiMetadata(accountRow);
      const accountHolder = account.debtor_account_id === accountId ? account.debtor_name : account.creditor_name;

      const counterpartyLinksSql = `
        SELECT DISTINCT counterparty_id
        FROM counterparty_account_links
        WHERE account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const counterpartyLinksResponse = await this.runSqlQuery(counterpartyLinksSql, 1);
      const counterpartyIds = (counterpartyLinksResponse?.data ?? []).map((row) => this.stripHudiMetadata(row).counterparty_id);

      if (counterpartyIds.length === 0) {
        throw new HttpException('No counterparties found for account', HttpStatus.NOT_FOUND);
      }

      const centerCounterpartyId = counterpartyIds[0];

      const networkEdgesSql = `
        SELECT 
          from_counterparty_id,
          to_counterparty_id,
          tx_count,
          total_amount,
          is_alerted_edge,
          is_investigated_edge,
          first_event_ts,
          last_event_ts
        FROM tx_network_counterparties_edges
        WHERE (from_counterparty_id = '${centerCounterpartyId}' 
           OR to_counterparty_id = '${centerCounterpartyId}')
          AND tenant_id = '${tenantId}'
      `;

      const edgesResponse = await this.runSqlQuery(networkEdgesSql, 1000);
      const edges = (edgesResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));

      const allCounterpartyIds = new Set<string>([centerCounterpartyId]);
      edges.forEach((edge) => {
        allCounterpartyIds.add(edge.from_counterparty_id);
        allCounterpartyIds.add(edge.to_counterparty_id);
      });

      const counterpartyNamesMap = new Map<string, string>();

      // Optimize: Get all counterparty names in a single query instead of N+1 queries
      if (allCounterpartyIds.size > 0) {
        const counterpartyIdsList = Array.from(allCounterpartyIds)
          .map((id) => `'${id}'`)
          .join(',');

        const namesSql = `
          SELECT DISTINCT
            cal.counterparty_id,
            CASE 
              WHEN cal.counterparty_id LIKE 'dbtr_%' THEN td.debtor_name
              ELSE td.creditor_name
            END as name
          FROM counterparty_account_links cal
          LEFT JOIN transaction_detail td ON (
            (cal.counterparty_id LIKE 'dbtr_%' AND td.debtor_account_id = cal.account_id) OR
            (cal.counterparty_id LIKE 'cdtr_%' AND td.creditor_account_id = cal.account_id)
          )
          WHERE cal.counterparty_id IN (${counterpartyIdsList})
            AND cal.tenant_id = '${tenantId}'
            AND td.tenant_id = '${tenantId}'
        `;

        const namesResponse = await this.runSqlQuery(namesSql, 1000);
        const namesRows = (namesResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));

        namesRows.forEach((row) => {
          if (row.counterparty_id && row.name) {
            counterpartyNamesMap.set(row.counterparty_id, row.name);
          }
        });

        // Fill in any missing names with the counterparty ID itself
        allCounterpartyIds.forEach((cpId) => {
          if (!counterpartyNamesMap.has(cpId)) {
            counterpartyNamesMap.set(cpId, cpId);
          }
        });
      }

      const counterpartiesData: CounterpartyDto[] = [];
      const processedCounterparties = new Set<string>([centerCounterpartyId]);

      edges.forEach((edge) => {
        const connectedId = edge.from_counterparty_id === centerCounterpartyId ? edge.to_counterparty_id : edge.from_counterparty_id;

        if (!processedCounterparties.has(connectedId)) {
          processedCounterparties.add(connectedId);

          const frequency = this.calculateFrequency(Number(edge.tx_count));

          counterpartiesData.push({
            counterpartyId: connectedId,
            counterpartyName: counterpartyNamesMap.get(connectedId) ?? connectedId,
            degree: 1,
            transactionCount: Number(edge.tx_count),
            totalValue: Math.round(Number(edge.total_amount) * 100) / 100,
            averageValue: Math.round((Number(edge.total_amount) / Number(edge.tx_count)) * 100) / 100,
            frequency,
            hasAlert: edge.is_alerted_edge === 1,
            isInvestigated: edge.is_investigated_edge === 1,
            firstTransactionDate: edge.first_event_ts,
            lastTransactionDate: edge.last_event_ts,
          });
        }
      });

      const seenEdges = new Set<string>();
      const networkEdges: CounterpartyNetworkEdgeDto[] = [];

      edges.forEach((edge, index) => {
        const edgeKey = [edge.from_counterparty_id, edge.to_counterparty_id].sort().join('->');
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          networkEdges.push({
            id: `edge-${networkEdges.length}`,
            source: edge.from_counterparty_id,
            target: edge.to_counterparty_id,
            transactionCount: Number(edge.tx_count),
            totalValue: Math.round(Number(edge.total_amount) * 100) / 100,
            hasAlert: edge.is_alerted_edge === 1,
            isInvestigated: edge.is_investigated_edge === 1,
          });
        }
      });

      const totalCounterparties = counterpartiesData.length;
      const firstDegreeConnections = counterpartiesData.filter((cp) => cp.degree === 1).length;
      const secondDegreeConnections = counterpartiesData.filter((cp) => cp.degree === 2).length;
      const counterpartiesWithAlerts = counterpartiesData.filter((cp) => cp.hasAlert).length;
      const counterpartiesUnderInvestigation = counterpartiesData.filter((cp) => cp.isInvestigated).length;
      const totalNetworkValue = counterpartiesData.reduce((sum, cp) => sum + cp.totalValue, 0);

      const networkSummary: CounterpartyNetworkSummaryDto = {
        totalCounterparties,
        firstDegreeConnections,
        secondDegreeConnections,
        counterpartiesWithAlerts,
        counterpartiesUnderInvestigation,
        totalNetworkValue: Math.round(totalNetworkValue * 100) / 100,
      };

      const centerCounterparty: CenterCounterpartyDto = {
        counterpartyId: centerCounterpartyId,
        counterpartyName: counterpartyNamesMap.get(centerCounterpartyId) ?? centerCounterpartyId,
        networkSummary,
      };

      return {
        accountId,
        accountHolder,
        centerCounterparty,
        counterparties: counterpartiesData,
        edges: networkEdges,
        timeRange,
        tenantId,
        queryTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error fetching counterparty network data: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch counterparty network data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private calculateFrequency(transactionCount: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (transactionCount > 10) return 'HIGH';
    if (transactionCount >= 5) return 'MEDIUM';
    return 'LOW';
  }

  // ---------------- DEBUG METHODS FOR DATA ANALYSIS ----------------

  async getAllConditionsTableData(tenantId: string) {
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
      this.logger.error(`Error fetching conditions table: ${error.message}`);
      throw new HttpException('Failed to fetch conditions table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAllConditionsTimelineData(tenantId: string) {
    try {
      this.logger.log('Fetching all conditions_timeline table data');
      // Try without WHERE clause first in case tenant_id column doesn't exist or table is empty
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
      this.logger.error(`Error fetching conditions_timeline table: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      // Return empty result instead of throwing to see if table exists but is empty
      return {
        tableName: 'conditions_timeline',
        totalRows: 0,
        data: [],
        error: error.message,
        note: 'Table may not exist or query failed',
      };
    }
  }

  async getAllAccountHolderData(tenantId: string) {
    try {
      this.logger.log('Fetching all account_holder table data');
      const sql = `SELECT * FROM account_holder WHERE tenant_id = '${tenantId}' LIMIT 200`;
      const response = await this.runSqlQuery(sql, 200);
      return {
        tableName: 'account_holder',
        totalRows: response.data?.length ?? 0,
        data: response.data ?? [],
      };
    } catch (error) {
      this.logger.error(`Error fetching account_holder table: ${error.message}`);
      throw new HttpException('Failed to fetch account_holder table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionDetailSampleData(tenantId: string) {
    try {
      this.logger.log('Fetching sample transaction_detail table data');
      const sql = `SELECT * FROM transaction_detail WHERE tenant_id = '${tenantId}' LIMIT 100`;
      const response = await this.runSqlQuery(sql, 100);
      return {
        tableName: 'transaction_detail',
        totalRows: response.data?.length ?? 0,
        data: response.data ?? [],
      };
    } catch (error) {
      this.logger.error(`Error fetching transaction_detail table: ${error.message}`);
      throw new HttpException('Failed to fetch transaction_detail table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ---------------- SPECIFIC ID TYPE METHODS (NO RESOLUTION) ----------------

  // Account ID based methods (direct from conditions_timeline)
  async getConditionsSummaryByAccount(accountId: string, tenantId = 'DEFAULT', fromDate?: string, asOfDate?: string) {
    try {
      this.logger.log(`Fetching conditions summary for account: ${accountId}`);
      // const dateFilter = fromDate ? `AND bucket_start >= '${fromDate}'` : '';

      // If asOfDate is provided, filter conditions active at that time
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

      // Get basic condition details for summary
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
      this.logger.error(`Error fetching conditions summary by account: ${message}`, error?.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(`Failed to fetch conditions summary: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getActiveConditionsByAccount(accountId: string, tenantId = 'DEFAULT', fromDate?: string) {
    try {
      this.logger.log(`Fetching active conditions for account: ${accountId}`);
      // const dateFilter = fromDate ? `AND bucket_start >= '${fromDate}'` : '';

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
      this.logger.error('Error fetching active conditions by account', error.stack);
      throw new HttpException('Failed to fetch active conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async getFutureConditionsByAccount(accountId: string, tenantId = 'DEFAULT') {
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
      this.logger.error('Error fetching future conditions by account', error.stack);
      throw new HttpException('Failed to fetch future conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsListByAccount(id: string, tenantId = 'DEFAULT', asOfDate?: string, showInactive = false) {
    try {
      this.logger.log(`Fetching all conditions for ID: ${id}`);

      // Build date filter
      let dateFilter = '';
      if (asOfDate && !showInactive) {
        // Show only conditions active at the specified date
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
      this.logger.error('Error fetching conditions list by account', error.stack);
      throw new HttpException('Failed to fetch conditions list', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvaluatedTransactionsByAccount(accountId: string, tenantId = 'DEFAULT', fromDate?: string) {
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
      this.logger.error('Error fetching evaluated transactions by account', error.stack);
      throw new HttpException('Failed to fetch evaluated transactions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Transaction ID based methods
  async getConditionsSummaryByTransaction(transactionId: number, tenantId = 'DEFAULT') {
    try {
      this.logger.log(`Fetching conditions summary for transaction: ${transactionId}`);

      // 1. Get transaction details to find debtor/creditor accounts
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

      // 2. Find conditions for both debtor and creditor accounts during transaction time
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
      this.logger.error('Error fetching conditions summary by transaction', error.stack);
      throw new HttpException('Failed to fetch conditions summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExpiredConditionsByTransaction(transactionId: number, tenantId = 'DEFAULT') {
    try {
      this.logger.log(`Fetching expired conditions for transaction: ${transactionId}`);

      // 1. Get transaction details
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

      // 2. Find expired conditions for both accounts
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
      this.logger.error('Error fetching expired conditions by transaction', error.stack);
      throw new HttpException('Failed to fetch expired conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionDetails(conditionId: string, tenantId = 'DEFAULT') {
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
      this.logger.error('Error fetching condition details', error.stack);
      throw new HttpException('Failed to fetch condition details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ================ NEW METHODS FOR CONDITIONS VIEW ================

  /**
   * Get full conditions context by Transaction ID
   * Returns transaction details with both parties, their accounts, and condition counts
   * Used for Conditions Timeline view
   */
  async getConditionsContextByTransaction(transactionId: number, tenantId = 'DEFAULT', asOfDate?: string) {
    try {
      this.logger.log(`Fetching conditions context for transaction: ${transactionId}`);

      // 1. Get transaction details
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

      // Use asOfDate or transaction timestamp for condition filtering
      const filterDate = asOfDate ?? tx.tx_event_ts;

      // Format transaction display ID
      const displayId = `TXN-${tx.tx_event_date?.replace(/-/g, '')}${transactionId}`;

      // 2. Get debtor entity accounts and condition counts
      const debtorAccounts = await this.getEntityAccountsWithConditionCounts(tx.debtor_id, tx.debtor_account_id, tenantId, filterDate);

      // 3. Get creditor entity accounts and condition counts
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
      this.logger.error(`Error fetching conditions context by transaction: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch conditions context', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Helper: Get all accounts for an entity with condition counts
   * Uses hybrid approach: includes transaction accounts + entity accounts from account_holder
   */
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
      // Use Set for automatic deduplication
      const accountIdsSet = new Set<string>();

      // PRIORITY 1: Always include the primary transaction account first (direct link)
      if (primaryAccountId && primaryAccountId !== 'no data found') {
        accountIdsSet.add(primaryAccountId);
      }

      // PRIORITY 2: Add all other accounts for this entity from account_holder (comprehensive view)
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

      // Convert Set back to Array
      const accountIds = Array.from(accountIdsSet);

      // Log for debugging
      this.logger.debug(
        `Found ${accountIds.length} unique accounts for entity ${entityId}: ` +
          `${primaryAccountId ? '1 transaction account' : 'no transaction account'} + ` +
          `${accountIds.length - (primaryAccountId ? 1 : 0)} from account_holder`,
      );

      if (accountIds.length === 0) {
        this.logger.warn(`No accounts found for entity ${entityId}`);
        return [];
      }

      // Get condition counts for each account
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

          // Get account details from transaction_detail (for account type/number)
          const accountDetailsSql = `
          SELECT DISTINCT
            CASE 
              WHEN debtor_account_id = '${accountId}' THEN debtor_account_id
              WHEN creditor_account_id = '${accountId}' THEN creditor_account_id
              ELSE '${accountId}'
            END as full_account_id
          FROM transaction_detail
          WHERE (debtor_account_id = '${accountId}' OR creditor_account_id = '${accountId}')
            AND tenant_id = '${tenantId}'
          LIMIT 1
          `;

          // const detailsResponse = await this.runSqlQuery(accountDetailsSql, 1);
          const accountNumber = accountId.slice(-12); // Last 12 chars for display

          return {
            accountId,
            accountNumber: `****${accountNumber}`,
            accountType: 'no mapping found', // Not available in current tables
            isTransactionAccount: accountId === primaryAccountId,
            activeConditionsCount: Number(counts.active ?? 0),
            expiredConditionsCount: Number(counts.expired ?? 0),
            futureConditionsCount: Number(counts.future ?? 0),
          };
        }),
      );

      return accountsWithCounts;
    } catch (error) {
      this.logger.error(`Error fetching entity accounts with condition counts: ${error.message}`);
      return [];
    }
  }

  /**
   * Get conditions for all accounts under an entity
   * Used for Entity Level view in Conditions Timeline
   */
  async getConditionsByEntity(entityId: string, tenantId = 'DEFAULT', asOfDate?: string, showInactive = false) {
    try {
      this.logger.log(`Fetching conditions for entity: ${entityId}`);

      // 1. Get all accounts for this entity
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

      // 2. Build date filter
      let dateFilter = '';
      if (asOfDate && !showInactive) {
        dateFilter = `
          AND condition_inception_ts <= '${asOfDate}'
          AND (condition_expiry_ts IS NULL OR condition_expiry_ts >= '${asOfDate}')
        `;
      }

      // 3. Get conditions for all accounts AND entity-level conditions
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
      this.logger.error('Error fetching conditions by entity', error.stack);
      throw new HttpException('Failed to fetch conditions by entity', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
