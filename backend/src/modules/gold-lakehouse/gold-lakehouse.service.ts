import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QueryRequestDto } from './dto/query-request.dto';
import { QueryResponseDto } from './dto/query-response.dto';

@Injectable()
export class GoldLakehouseService {
  protected readonly logger = new Logger(GoldLakehouseService.name);
  protected readonly apiUrl: string;
  protected readonly timeout: number;
  protected readonly alertHistoryFallbackE2EId: string;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
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

  /**
   * Escapes a value for safe SQL interpolation
   * @param value - The value to escape
   * @returns Escaped SQL string value
   */
  private escapeSqlValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    // Escape single quotes by doubling them and wrap in quotes
    // prettier-ignore
    const escaped = String(value).replace(/'/gv, '\'\'');
    return `'${escaped}'`;
  }

  async runSqlQuery(sql: string, limit = 1, parameters?: any[]): Promise<any> {
    try {
      let finalSql = sql;

      // If parameters are provided, substitute them safely
      if (parameters && parameters.length > 0) {
        parameters.forEach((param, index) => {
          const placeholder = `$${index + 1}`;
          const escapedValue = this.escapeSqlValue(param);
          // Use replaceAll to handle multiple occurrences of the same parameter
          finalSql = finalSql.replaceAll(placeholder, escapedValue);
        });
      }

      this.logger.log('Running raw SQL query on Gold Lakehouse');
      this.logger.log(finalSql);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/execute_sql`,
          {
            sql_query: finalSql,
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

      throw new HttpException(`Failed to run SQL query on Gold Lakehouse: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  protected stripHudiMetadata(record: Record<string, any>): Record<string, any> {
    const hudiFields = ['_hoodie_commit_time', '_hoodie_commit_seqno', '_hoodie_record_key', '_hoodie_partition_path', '_hoodie_file_name'];
    return Object.fromEntries(Object.entries(record).filter(([key]) => !hudiFields.includes(key)));
  }

  protected async resolveToAccounts(id: string, tenantId: string): Promise<string[]> {
    // numeric transaction id?
    if (/^\d+$/v.test(id)) {
      const resp = await this.query({
        table_name: 'transaction_detail',
        filters: { transaction_id: parseInt(id, 10), tenant_id: tenantId },
        columns: ['debtor_account_id', 'creditor_account_id'],
      });
      const [row = {}] = resp.data;
      return [row.debtor_account_id, row.creditor_account_id].filter(Boolean) as string[];
    }

    // uuid end-to-end id?
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-/iv;
    if (uuidRegex.test(id)) {
      const resp = await this.query({
        table_name: 'transaction_detail',
        filters: { end_to_end_id: id, tenant_id: tenantId },
        columns: ['debtor_account_id', 'creditor_account_id'],
      });
      const [row = {}] = resp.data;
      return [row.debtor_account_id, row.creditor_account_id].filter(Boolean) as string[];
    }

    // Try to resolve as entity ID (entity â†’ multiple accounts)
    const resp = await this.query({
      table_name: 'account_holder',
      filters: { source: id, tenant_id: tenantId },
      columns: ['destination'],
    });
    const accts = resp.data.map((r) => r.destination).filter(Boolean) as string[];

    // If entity lookup returned accounts, use those (entity-level query)
    if (accts.length > 0) {
      return Array.from(new Set(accts));
    }

    // Otherwise, treat the ID as a direct account ID (account-level query)
    return [id];
  }

  protected calculateVelocity(totalTransactions: number, durationDays: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (durationDays === 0) return 'LOW';

    const txPerDay = totalTransactions / durationDays;

    if (txPerDay > 0.5) return 'HIGH';
    if (txPerDay >= 0.2) return 'MEDIUM';
    return 'LOW';
  }

  protected calculateFrequency(transactionCount: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (transactionCount > 10) return 'HIGH';
    if (transactionCount >= 5) return 'MEDIUM';
    return 'LOW';
  }
}
