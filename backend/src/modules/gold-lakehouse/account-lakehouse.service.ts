import { Injectable, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { AccountNodeFullDataResponse, CounterpartyNodeFullDataResponse } from './types/gold-lakehouse-responses.types';
import { AlertRepository } from '../repository/alert.repository';
import { extractReferenceId } from '../repository/utils/extractReferenceId';
import { JsonValue } from '../repository/utils/types/JsonValue';
import { EntityMetadataResponse } from './interfaces/entity-metadata.interfaces';

@Injectable()
export class AccountLakehouseService extends GoldLakehouseService {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    private readonly alertRepository: AlertRepository,
  ) {
    super(httpService, configService);
  }

  async getEntityMetadataByAlertId(alertId: number, tenantId: string): Promise<EntityMetadataResponse> {
    try {
      const alert = await this.alertRepository.getAlertById(alertId);
      if (!alert) {
        throw new InternalServerErrorException(`Unable to fetch details for AlertId ${alertId}`);
      }

      const referenceIdData = await this.alertRepository.getReferenceId(alert.txtp);
      const referenceId = extractReferenceId(alert.transaction as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
      if (!referenceId) {
        throw new Error('ReferenceId not found in transaction data');
      }

      const entitySQL = `SELECT DISTINCT td.debtor_Id, td.debtor_account_id, td.debtor_name, td.creditor_id, td.creditor_account_id, td.creditor_name FROM transaction_detail td WHERE td.end_to_end_id = '${referenceId}' AND tx_type = 'pacs.008.001.10'`;
      const entityMetadataResp = await this.runSqlQuery(entitySQL, 1);
      const entityMetadataRow = entityMetadataResp.data?.[0];
      const entityMetadata = {
        debtorId: entityMetadataRow?.debtor_id,
        debtorAccountId: entityMetadataRow?.debtor_account_id,
        debtorName: entityMetadataRow?.debtor_name,
        creditorId: entityMetadataRow?.creditor_id,
        creditorAccountId: entityMetadataRow?.creditor_account_id,
        creditorName: entityMetadataRow?.creditor_name,
      };

      return entityMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in getEntityMetadataByAlertId: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async getAccountNodeFullData(
    accountId: string,
    tenantId = 'DEFAULT',
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<AccountNodeFullDataResponse> {
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

      const velocity: 'HIGH' | 'MEDIUM' | 'LOW' = txCount >= 50 ? 'HIGH' : txCount >= 10 ? 'MEDIUM' : 'LOW';

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
          velocity,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching full account node data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch account network and details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCounterpartyNodeFullData(
    counterpartyId: string,
    tenantId = 'DEFAULT',
    granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<CounterpartyNodeFullDataResponse> {
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

      const velocity: 'HIGH' | 'MEDIUM' | 'LOW' = txCount >= 50 ? 'HIGH' : txCount >= 10 ? 'MEDIUM' : 'LOW';

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
          velocity,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in getCounterpartyNodeFullData: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch counterparty network details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
