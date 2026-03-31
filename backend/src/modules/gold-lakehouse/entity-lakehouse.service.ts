import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { EntityAccountsResponse } from './types/entity.types';

@Injectable()
export class EntityLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getEntityAccounts(entityId: string, tenantId: string): Promise<EntityAccountsResponse> {
    try {
      const resp = await this.query({
        table_name: 'account_holder',
        filters: { source: entityId, tenant_id: tenantId },
        columns: ['destination', 'account_id'],
      });

      const accounts = resp.data.map((r) => r.destination ?? r.account_id).filter(Boolean);
      const uniqueAccounts = Array.from(new Set(accounts));

      return {
        entityId,
        accountCount: uniqueAccounts.length,
        accounts: uniqueAccounts,
        tenantId,
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching entity accounts for ${entityId}`, errorStack);
      return {
        entityId,
        accountCount: 0,
        accounts: [],
        tenantId,
      };
    }
  }

  async getAllAccountHolderData(tenantId: string): Promise<unknown> {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching account_holder table: ${errorMessage}`);
      throw new HttpException('Failed to fetch account_holder table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
