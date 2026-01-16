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
    this.apiUrl = this.configService.get<string>('GOLD_LAKEHOUSE_API_URL', 'http://localhost:8000');
    this.timeout = this.configService.get<number>('GOLD_LAKEHOUSE_TIMEOUT', 30000);
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
      this.logger.log(`Running raw SQL query on Gold Lakehouse`);
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

      const [headerResponse, typologiesResponse, rulesResponse, alertDetailsResponse] = await Promise.all([
        this.query({
          table_name: 'alert_navigator_header',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
        this.query({
          table_name: 'alert_navigator_typologies',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
        this.query({
          table_name: 'alert_navigator_rules',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
        this.query({
          table_name: 'alerts',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
      ]);

      const header = headerResponse.data?.[0] || null;
      const rawTypologies = typologiesResponse.data || [];
      const rawRules = rulesResponse.data || [];
      const alertDetails = alertDetailsResponse.data?.[0] || null;

      let transactionSummary: any = null;

      if (alertDetails?.tx_msg_id) {
        try {
          const transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { tx_msg_id: alertDetails.tx_msg_id, tenant_id: tenantId },
            columns: ['end_to_end_id', 'tx_msg_id', 'tx_amount', 'tx_ccy', 'event_ts', 'tx_status', 'transaction_id'],
          });
          const txData = transactionResponse.data?.[0];
          if (txData) {
            transactionSummary = {
              transaction_id: txData.end_to_end_id,
              tx_msg_id: txData.tx_msg_id,
              amount: txData.tx_amount,
              currency: txData.tx_ccy,
              timestamp: txData.event_ts,
              status: txData.tx_status,
            };
          }
        } catch (error) {
          this.logger.warn(`Could not fetch transaction for tx_msg_id: ${alertDetails.tx_msg_id}`);
        }
      }

      if (!transactionSummary && header?.end_to_end_id) {
        try {
          this.logger.log(`Trying to fetch transaction by end_to_end_id: ${header.end_to_end_id}`);
          const transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { end_to_end_id: header.end_to_end_id, tenant_id: tenantId },
            columns: ['end_to_end_id', 'tx_msg_id', 'tx_amount', 'tx_ccy', 'event_ts', 'tx_status', 'transaction_id'],
          });
          const txData = transactionResponse.data?.[0];
          if (txData) {
            transactionSummary = {
              transaction_id: txData.end_to_end_id,
              tx_msg_id: txData.tx_msg_id,
              amount: txData.tx_amount,
              currency: txData.tx_ccy,
              timestamp: txData.event_ts,
              status: txData.tx_status,
            };
          }
        } catch (error) {
          this.logger.warn(`Could not fetch transaction by end_to_end_id: ${header.end_to_end_id}`);
        }
      }

      if (!transactionSummary && header?.transaction_id) {
        try {
          this.logger.log(`Trying to fetch transaction by transaction_id: ${header.transaction_id}`);
          const transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { transaction_id: header.transaction_id, tenant_id: tenantId },
            columns: ['end_to_end_id', 'tx_msg_id', 'tx_amount', 'tx_ccy', 'event_ts', 'tx_status', 'transaction_id'],
          });
          const txData = transactionResponse.data?.[0];
          if (txData) {
            transactionSummary = {
              transaction_id: txData.end_to_end_id,
              tx_msg_id: txData.tx_msg_id,
              amount: txData.tx_amount,
              currency: txData.tx_ccy,
              timestamp: txData.event_ts,
              status: txData.tx_status,
            };
          }
        } catch (error) {
          this.logger.warn(`Could not fetch transaction by transaction_id: ${header.transaction_id}`);
        }
      }

      if (!transactionSummary && header?.evaluation_id) {
        try {
          this.logger.log(`Trying to fetch transaction by evaluation_id as end_to_end_id: ${header.evaluation_id}`);
          const transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { end_to_end_id: header.evaluation_id, tenant_id: tenantId },
            columns: ['end_to_end_id', 'tx_msg_id', 'tx_amount', 'tx_ccy', 'event_ts', 'tx_status', 'transaction_id'],
          });
          const txData = transactionResponse.data?.[0];
          if (txData) {
            transactionSummary = {
              transaction_id: txData.end_to_end_id,
              tx_msg_id: txData.tx_msg_id,
              amount: txData.tx_amount,
              currency: txData.tx_ccy,
              timestamp: txData.event_ts,
              status: txData.tx_status,
            };
          }
        } catch (error) {
          this.logger.warn(`Could not fetch transaction by evaluation_id: ${header.evaluation_id}`);
        }
      }

      // Transform to frontend-expected format
      const typologies = rawTypologies.map((t) => {
        const cleaned = this.stripRedundantFields(this.stripHudiMetadata(t));
        return {
          id: cleaned.typology_id?.toString() || '',
          score: cleaned.typology_score || 0,
          threshold: cleaned.typology_threshold || 0,
          rules: rawRules
            .filter((r) => r.typology_id === t.typology_id)
            .map((r) => {
              const cleanedRule = this.stripRedundantFields(this.stripHudiMetadata(r));
              return {
                id: cleanedRule.rule_id?.toString() || '',
                weight: cleanedRule.rule_weight || 0,
              };
            }),
        };
      });

      const rules = rawRules.map((r) => {
        const cleaned = this.stripRedundantFields(this.stripHudiMetadata(r));
        return {
          id: cleaned.rule_id?.toString() || '',
          weight: cleaned.rule_weight || 0,
        };
      });

      const amount = {
        value: transactionSummary?.amount || header?.alert_amount || 0,
        currency: transactionSummary?.currency || header?.alert_currency || 'USD',
      };

      const relatedLinks = {
        transactionDetail: `/triage/transaction-detail/${transactionSummary?.tx_msg_id || ''}`,
        transactionHistory: `/api/v1/transactions/${transactionSummary?.tx_msg_id || ''}/history`,
        conditionsView: `/api/v1/alerts/${alertId}/conditions`,
        alertHistory: `/api/v1/triage/alerts/${alertId}/action-history`,
        jupyterLab: `/notebooks/transaction-viz.ipynb?alertId=${alertId}`,
      };

      const links = [
        {
          rel: 'alert-navigator',
          href: `/api/v1/lakehouse/alert-navigator/${alertId}?tenantId=${tenantId}`,
        },
        {
          rel: 'transaction-history',
          href: `/api/v1/transactions/${transactionSummary?.tx_msg_id || ''}/history`,
        },
      ];

      return {
        alertId: alertId.toString(),
        transactionId: transactionSummary?.tx_msg_id || transactionSummary?.transaction_id || '',
        timestamp: transactionSummary?.timestamp || header?.alert_timestamp || '',
        transactionType: header?.transaction_type || '',
        amount,
        status: alertDetails?.alert_status || header?.alert_status || '',
        reason: alertDetails?.alert_message || header?.alert_message || '',
        blockReason: header?.block_reason || '',
        typologies,
        rules,
        blockStatus: header?.block_status
          ? {
              status: header.block_status,
              reason: header.block_reason || '',
            }
          : null,
        relatedLinks,
        links,
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
      const NA = 'no mapping found';

      return {
        transactionOverview: {
          transactionId: row.transaction_id ?? NA,
          timestamp: row.tx_event_ts ?? NA,
          type: row.tx_type ?? NA,
          status: NA,
        },

        transactionFlow: {
          amount: row.interbank_settlement_amount ?? NA,
          currency: row.interbank_settlement_currency ?? NA,

          debtor: {
            name: row.debtor_name ?? NA,
            account: row.debtor_account_id ?? NA,
            bank: row.instd_mmb_id ?? NA,
          },

          creditor: {
            name: row.creditor_name ?? NA,
            account: row.creditor_account_id ?? NA,
            bank: row.instg_mmb_id ?? NA,
          },
        },

        debtorProfile: {
          name: row.debtor_name ?? NA,
          accountNumber: row.debtor_account_id ?? NA,
          accountType: NA,
          bank: row.instg_mmb_id ?? NA,
          swiftCode: NA,
          address: NA,
        },

        creditorProfile: {
          name: row.creditor_name ?? NA,
          accountNumber: row.creditor_account_id ?? NA,
          accountType: NA,
          bank: row.instd_mmb_id ?? NA,
          swiftCode: NA,
          address: NA,
        },

        amountAndCurrency: {
          originalAmount: row.instructed_amount ?? NA,
          originalCurrency: row.instructed_currency ?? NA,
          exchangeRate: row.exchange_rate ?? NA,
          convertedAmount: NA,
        },

        charges: {
          senderCharges: NA,
          intermediaryCharges: NA,
          receiverCharges: NA,
          totalCharges: row.charge_total_amount ?? NA,
          chargeCurrency: row.charge_currency ?? NA,
        },

        settlementDetails: {
          transactionTimestamp: row.tx_event_ts ?? NA,
          settlementDate: row.tx_event_date ?? NA,
          reference: NA,
          purpose: NA,
        },

        meta: {
          transactionId,
          tenantId,
        },
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
}
