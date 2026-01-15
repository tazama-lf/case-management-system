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
        this.httpService.post<QueryResponseDto>(
          `${this.apiUrl}/query`,
          queryRequest,
          { timeout: this.timeout }
        )
      );

      if (response.data.status !== 'success') {
        throw new HttpException(
          `Gold Lakehouse query failed with status: ${response.data.status}`,
          response.data.code || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error querying Gold Lakehouse: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        this.logger.error(`Gold Lakehouse API is not reachable at ${this.apiUrl}`);
        throw new HttpException(
          `Gold Lakehouse API is not running or not reachable at ${this.apiUrl}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to query Gold Lakehouse: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
      const typologies = typologiesResponse.data || [];
      const rules = rulesResponse.data || [];
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

      return {
        header: header ? this.stripHudiMetadata(header) : null,
        typologies: typologies.map(t => this.stripRedundantFields(this.stripHudiMetadata(t))),
        rules: rules.map(r => this.stripRedundantFields(this.stripHudiMetadata(r))),
        transaction: transactionSummary,
        alertId,
        tenantId,
      };
    } catch (error) {
      this.logger.error(`Error fetching Alert Navigator data: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to fetch Alert Navigator data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getTransactionDetailData(transactionId: string, tenantId: string = 'DEFAULT') {
    try {
      this.logger.log(`Fetching Transaction Detail data for transaction: ${transactionId}`);

      let transaction: Record<string, any> | null = null;
      let detail: Record<string, any> | null = null;

      
      try {
        
        let transactionResponse = await this.query({
          table_name: 'transactions',
          filters: { end_to_end_id: transactionId, tenant_id: tenantId },
        });
        transaction = transactionResponse.data?.[0] || null;

       
        if (!transaction) {
          this.logger.log(`Trying to fetch transaction by transaction_id: ${transactionId}`);
          transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { transaction_id: parseInt(transactionId) || transactionId, tenant_id: tenantId },
          });
          transaction = transactionResponse.data?.[0] || null;
        }

        
        if (!transaction) {
          this.logger.log(`Trying to fetch transaction by tx_msg_id: ${transactionId}`);
          transactionResponse = await this.query({
            table_name: 'transactions',
            filters: { tx_msg_id: transactionId, tenant_id: tenantId },
          });
          transaction = transactionResponse.data?.[0] || null;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch transaction from transactions table: ${error.message}`);
      }

     
      if (transaction) {
        const txEndToEndId = transaction.end_to_end_id;
        const txId = transaction.transaction_id;

        
        try {
          const detailResponse = await this.query({
            table_name: 'transaction_detail',
            filters: { end_to_end_id: txEndToEndId, tenant_id: tenantId },
          });
          detail = detailResponse.data?.[0] || null;

          if (!detail && txId) {
            const detailResponse2 = await this.query({
              table_name: 'transaction_detail',
              filters: { transaction_id: txId, tenant_id: tenantId },
            });
            detail = detailResponse2.data?.[0] || null;
          }
        } catch (error) {
          this.logger.warn(`transaction_detail table not available or empty`);
        }
      }

      
      let mergedData: Record<string, any> | null = null;
      if (transaction) {
        const strippedTransaction = this.stripHudiMetadata(transaction);
        
        if (detail) {
          const strippedDetail = this.stripHudiMetadata(detail);
          
          
          const coreFields = {
            transaction_id: strippedTransaction.transaction_id,
            end_to_end_id: strippedTransaction.end_to_end_id,
            tx_msg_id: strippedTransaction.tx_msg_id,
            tenant_id: strippedTransaction.tenant_id,
          };
          
          
          mergedData = { ...strippedTransaction, ...strippedDetail, ...coreFields };
        } else {
          mergedData = strippedTransaction;
        }
      }

      return {
        transaction: mergedData,
        transactionId,
        tenantId,
      };
    } catch (error) {
      this.logger.error(`Error fetching Transaction Detail data: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to fetch Transaction Detail data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private stripHudiMetadata(record: Record<string, any>): Record<string, any> {
    const hudiFields = [
      '_hoodie_commit_time',
      '_hoodie_commit_seqno',
      '_hoodie_record_key',
      '_hoodie_partition_path',
      '_hoodie_file_name',
    ];

    const cleaned = { ...record };
    hudiFields.forEach(field => delete cleaned[field]);
    return cleaned;
  }

  private stripRedundantFields(record: Record<string, any>): Record<string, any> {
    const redundantFields = [
      'alert_id',
      'tenant_id',
      'tx_msg_id',
      'alert_timestamp',
      'pk',
      'ingested_at_ts',
    ];

    const cleaned = { ...record };
    redundantFields.forEach(field => delete cleaned[field]);
    return cleaned;
  }
}

