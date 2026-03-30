import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { BenfordAnalysisResponse } from './types/benfords-law.types';

@Injectable()
export class BenfordsLawLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getBenfordAnalysisByAccount(
    accountId: string,
    tenantId: string,
    fromDate: string,
    toDate: string,
  ): Promise<BenfordAnalysisResponse> {
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
        const s = value.toString().replace('.', '').replace(/^0+/v, '');
        if (!s) continue;

        const digit = parseInt(s[0], 10);
        if (digit >= 1 && digit <= 9) {
          counts[digit] += 1;
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error running Benford analysis for account ${accountId}: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to perform Benford analysis', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
