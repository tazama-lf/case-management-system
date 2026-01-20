import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QueryRequestDto } from './dto/query-request.dto';
import { QueryResponseDto } from './dto/query-response.dto';

@Injectable()
export class GoldLakehouseService {
  private readonly logger = new Logger(GoldLakehouseService.name);
  private readonly apiUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('GOLD_LAKEHOUSE_API_URL');
    this.timeout = this.configService.get<number>('GOLD_LAKEHOUSE_TIMEOUT') || 30000;
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
    } catch (error) {
      this.logger.error(`Error querying Gold Lakehouse: ${error.message}`);

      if (error.code === 'ECONNREFUSED') {
        this.logger.error(`Gold Lakehouse API is not reachable at ${this.apiUrl}`);
        throw new HttpException(`Gold Lakehouse API is not running or not reachable at ${this.apiUrl}`, HttpStatus.SERVICE_UNAVAILABLE);
      }

      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(`Failed to query Gold Lakehouse: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async runSqlQuery(sql: string, limit = 1) {
    try {
      this.logger.log('Running raw SQL query on Gold Lakehouse');
      this.logger.debug(sql);

      const response = await firstValueFrom(
        this.httpService.post<any>(
          `${this.apiUrl}/execute_sql`,
          {
            sql_query: sql,
            limit,
          },
          { timeout: this.timeout },
        ),
      );

      if (response.data.status !== 'success') {
        throw new HttpException('Gold Lakehouse SQL query failed', response.data.code || HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error running SQL query: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Failed to run SQL query on Gold Lakehouse', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertNavigatorMetrics(alertId: number, tenantId: string = 'DEFAULT') {
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
        avg_typology_score: row?.avg_typology_score !== null ? Number(row.avg_typology_score) : null,
        alertId,
        tenantId,
      };
    } catch (error) {
      this.logger.error(`Error fetching Alert Navigator metrics: ${error.message}`, error.stack);

      throw new HttpException('Failed to fetch Alert Navigator metrics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertNavigatorData(alertId: number, tenantId: string = 'DEFAULT') {
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
      const rulesRaw = rulesResponse?.data || [];

      // Alert Metadata
      const alertMetadata = {
        alertId: combined.alert_id,
        transactionId: combined.tx_transaction_id || combined.end_to_end_id || combined.transaction_id,
        timestamp: combined.created_at_ts || combined.ingested_at_ts,
        transactionType: combined.alert_tx_type || combined.tx_type,
        amount: combined.alert_tx_amount || combined.tx_amount,
        currency: combined.alert_tx_ccy || combined.tx_ccy,
        status: combined.alert_status,
        reason: combined.alert_reason,
        blockReason: combined.block_or_override_status,
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
          typologyId: typology.typology_id,
          typologyCfg: typology.typology_cfg,
          typologyScore: typology.typology_score,
          alertThreshold: typology.alert_threshold,
          interdictionThreshold: typology.interdiction_threshold,
          ruleCount: typology.rule_count_in_typology,
          rules: typologyRules,
        };
      });

      // Calculate summary statistics
      const totalTypologies = typologies.length;
      const totalRules = rulesRaw.length;
      const avgScore = totalTypologies > 0 ? typologies.reduce((sum, t) => sum + (t.typologyScore || 0), 0) / totalTypologies : 0;

      return {
        alertMetadata,
        typologies,
        statistics: {
          totalTypologies,
          totalRules,
          avgScore: Math.round(avgScore * 100) / 100,
        },
        meta: {
          alertId,
          tenantId,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching Alert Navigator data: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch Alert Navigator data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionDetailData(transactionId: number, tenantId: string = 'DEFAULT') {
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
          transactionId: row.transaction_id || '',
          transactionType: row.tx_type || '',
          timestamp: row.tx_event_ts || '',
        },
        transactionFlow: {
          debtor: {
            name: row.debtor_name || '',
            account: {
              iban: row.debtor_account_id || '',
              type: 'CHECKING',
            },
            bank: row.instd_mmb_id || '',
          },
          amount: {
            amount: row.interbank_settlement_amount || 0,
            currency: row.interbank_settlement_currency || 'USD',
          },
          creditor: {
            name: row.creditor_name || '',
            account: {
              iban: row.creditor_account_id || '',
              type: 'CHECKING',
            },
            bankName: row.instg_mmb_id || '',
          },
        },
        debtorProfile: {
          name: row.debtor_name || '',
          account: {
            iban: row.debtor_account_id || '',
            type: 'CHECKING',
          },
          bank: row.instd_mmb_id || '',
          swiftCode: '',
          address: '',
          accountType: 'CHECKING',
        },
        creditorProfile: {
          name: row.creditor_name || '',
          account: {
            iban: row.creditor_account_id || '',
            type: 'CHECKING',
          },
          bank: row.instg_mmb_id || '',
          swiftCode: '',
          address: '',
          accountType: 'CHECKING',
        },
        amountAndCurrency: [
          {
            originalAmount: row.instructed_amount || 0,
            exchangeRate: row.exchange_rate || 1,
            convertedAmount: row.interbank_settlement_amount || 0,
          },
          {
            senderCharges: [],
            intermediaryCharges: [],
            receiverCharges: [],
          },
          {
            totalCharges: row.charge_total_amount || 0,
          },
        ],
        settlementDetails: {
          settlementDate: row.tx_event_date || '',
          reference: row.transaction_id || '',
          purpose: '',
        },
        links: [
          {
            rel: 'self',
            href: `/api/v1/lakehouse/transaction-detail/${transactionId}?tenantId=${tenantId}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Error fetching Transaction Detail data: ${error.message}`, error.stack);

      throw new HttpException('Failed to fetch Transaction Detail data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionOverviewUIData(transactionId: number, tenantId: string = 'DEFAULT') {
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

      const mapField = (field: string) => {
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
    } catch (error) {
      this.logger.error(`Error building Transaction Overview UI data: ${error.message}`, error.stack);

      throw new HttpException('Failed to fetch Transaction Overview data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsSummary(accountId: string, tenantId: string = 'DEFAULT', fromDate?: string) {
    try {
      const dateFilter = fromDate ? `AND bucket_start >= '${fromDate}'` : '';

      const sql = `
      SELECT
        COUNT(DISTINCT cond_condition_id)
        FILTER (WHERE cond_is_active = 1)  AS active_conditions,
        COUNT(*) FILTER (WHERE tx_block_override_status = 'BLOCKED') AS blocked_transactions,
        COUNT(*) FILTER (WHERE tx_block_override_status = 'OVERRIDDEN') AS overridden_transactions,
        COUNT(DISTINCT cond_condition_id)
          FILTER (WHERE cond_is_active = 0 AND cond_is_expired = 0) AS future_conditions
      FROM conditions_timeline
      WHERE cond_account_id = '${accountId}'
        AND cond_tenant_id = '${tenantId}'
        ${dateFilter}
    `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response.data?.[0] || {};

      return {
        activeConditions: Number(row.active_conditions ?? 0),
        blockedTransactions: Number(row.blocked_transactions ?? 0),
        overriddenTransactions: Number(row.overridden_transactions ?? 0),
        futureConditions: Number(row.future_conditions ?? 0),
      };
    } catch (error) {
      this.logger.error('Error fetching conditions summary', error.stack);
      throw new HttpException('Failed to fetch conditions summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConditionsList(accountId: string, tenantId: string = 'DEFAULT') {
    try {
      const response = await this.query({
        table_name: 'conditions',
        filters: {
          account_id: accountId,
          tenant_id: tenantId,
        },
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

  async getActiveConditions(accountId: string, tenantId: string = 'DEFAULT', fromDate?: string) {
    try {
      const dateFilter = fromDate ? `AND ct.bucket_start >= '${fromDate}'` : '';

      const sql = `
      SELECT DISTINCT
        c.condition_id,
        c.condition_reason,
        c.condition_type,
        c.created_by_user,
        c.condition_inception_ts,
        c.condition_expiry_ts
      FROM conditions_timeline ct
      JOIN conditions c
        ON c.condition_id = ct.cond_condition_id
       AND c.tenant_id = ct.cond_tenant_id
      WHERE ct.cond_account_id = '${accountId}'
        AND ct.cond_tenant_id = '${tenantId}'
        AND ct.cond_is_active = 1
        ${dateFilter}
      ORDER BY c.condition_inception_ts DESC
    `;

      const response = await this.runSqlQuery(sql, 100);
      const rows = response.data || [];

      return rows.map((r) => ({
        conditionId: r.condition_id,
        title: r.condition_reason,
        createdBy: r.created_by_user,
        startDate: r.condition_inception_ts,
        endDate: r.condition_expiry_ts ?? null,
        notes: r.condition_reason,
        action: r.condition_type === 'overridable-block' ? 'OVERRIDE' : 'BLOCK',
      }));
    } catch (error) {
      this.logger.error('Error fetching active conditions', error.stack);
      throw new HttpException('Failed to fetch active conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExpiredConditions(accountId: string, tenantId: string = 'DEFAULT') {
    try {
      const sql = `
      SELECT
        condition_id,
        condition_reason,
        condition_inception_ts,
        condition_expiry_ts
      FROM conditions
      WHERE account_id = '${accountId}'
        AND tenant_id = '${tenantId}'
        AND is_expired = 1
      ORDER BY condition_expiry_ts DESC
    `;

      const response = await this.runSqlQuery(sql, 100);
      const rows = response.data || [];

      return rows.map((r) => ({
        conditionId: r.condition_id,
        title: r.condition_reason,
        startDate: r.condition_inception_ts,
        endDate: r.condition_expiry_ts,
      }));
    } catch (error) {
      this.logger.error('Error fetching expired conditions', error.stack);
      throw new HttpException('Failed to fetch expired conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFutureConditions(accountId: string, tenantId: string = 'DEFAULT') {
    try {
      const sql = `
      SELECT
        condition_id,
        condition_reason,
        condition_inception_ts
      FROM conditions
      WHERE account_id = '${accountId}'
        AND tenant_id = '${tenantId}'
        AND is_active = 0
        AND is_expired = 0
      ORDER BY condition_inception_ts ASC
    `;

      const response = await this.runSqlQuery(sql, 100);
      const rows = response.data || [];

      return rows.map((r) => ({
        conditionId: r.condition_id,
        title: r.condition_reason,
        startDate: r.condition_inception_ts,
      }));
    } catch (error) {
      this.logger.error('Error fetching future conditions', error.stack);
      throw new HttpException('Failed to fetch future conditions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvaluatedTransactions(accountId: string, tenantId: string = 'DEFAULT', fromDate?: string) {
    try {
      const dateFilter = fromDate ? `AND bucket_start >= '${fromDate}'` : '';

      const sql = `
      SELECT
        tx_transaction_id,
        tx_event_ts,
        tx_type,
        tx_amount,
        tx_ccy,
        tx_block_override_status,
        cond_condition_id,
        cond_reason
      FROM conditions_timeline
      WHERE cond_account_id = '${accountId}'
        AND cond_tenant_id = '${tenantId}'
        ${dateFilter}
      ORDER BY tx_event_ts DESC
    `;

      const response = await this.runSqlQuery(sql, 500);
      const rows = response.data || [];

      return rows.map((r) => ({
        transactionId: r.tx_transaction_id,
        date: r.tx_event_ts,
        type: r.tx_type,
        amount: r.tx_amount,
        currency: r.tx_ccy,
        outcome: r.tx_block_override_status ?? 'PASSED',
        conditionId: r.cond_condition_id ?? '-',
        reason: r.cond_reason ?? 'No conditions triggered',
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

  private stripRedundantFields(record: Record<string, any>): Record<string, any> {
    const redundantFields = ['alert_id', 'tenant_id', 'tx_msg_id', 'alert_timestamp', 'pk', 'ingested_at_ts'];

    const cleaned = { ...record };
    redundantFields.forEach((field) => delete cleaned[field]);
    return cleaned;
  }

  async getTransactionHistoryData(
    entityId: string,
    tenantId: string = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ) {
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
        aggregates = (aggResponse?.data || []).map((a) => this.stripHudiMetadata(a));
      }

      const events = (eventsResponse?.data || []).map((e) => this.stripHudiMetadata(e));

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
          expectedTxCount = parseInt(baselineData.total_tx_count) || null;
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
        type: e.tx_type || 'Unknown',
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
        const counterparty = e.entity_role === 'DEBTOR' ? e.creditor_name || 'Unknown Creditor' : e.debtor_name || 'Unknown Debtor';

        const status: string[] = [];
        if (e.is_alerted === 1) status.push('Alert');
        if (e.is_investigated === 1) status.push('Investigated');

        return {
          transactionId: e.transaction_id,
          date: e.event_date,
          type: e.tx_type || 'Unknown',
          counterparty: counterparty,
          amount: parseFloat(e.tx_amount) || 0,
          currency: e.tx_ccy,
          status: status,
          actions: {
            viewDetailsLink: `/triage/transaction-detail/${e.transaction_id}`,
          },
        };
      });

      return {
        summary: {
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalTransactions: totalTransactions,
          transactionCount: totalTransactions,
          alertsTriggered: alertsTriggered,
          alertsPercentage: Math.round(alertsPercentage * 100) / 100,
          investigated: investigated,
          investigatedPercentage: Math.round(investigatedPercentage * 100) / 100,
          avgTransactionsPerDay: Math.round(avgTransactionsPerDay * 100) / 100,
          durationDays: durationDays,
          bucketTotalVolume: Math.round(bucketTotalVolume * 100) / 100,
          bucketTotalTransactions: bucketTotalTransactions,
          expected: {
            transactionCount: expectedTxCount,
            volume: expectedVolume ? Math.round(expectedVolume * 100) / 100 : null,
          },
          actual: {
            transactionCount: totalTransactions,
            volume: Math.round(totalVolume * 100) / 100,
          },
        },
        timeline: timeline,
        cumulative: cumulative,
        volumeDistribution: volumeDistribution,
        recentTransactions: recentTransactions,
        meta: {
          entityId: entityId,
          tenantId: tenantId,
          granularity: granularity || null,
          startDate: startDate || null,
          endDate: endDate || null,
          eventRowCount: events.length,
          aggRowCount: aggregates.length,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching Transaction History data: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch Transaction History data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private mapTransactionType(txType: string): string {
    // Return raw transaction type code (e.g., 'pacs.008.001.10')
    return txType || 'Unknown';
  }
}
