import { Injectable, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import {
  AccountNodeFullDataResponse,
  CounterpartyNodeFullDataResponse,
  NetworkNode,
  NetworkEdge,
} from './types/gold-lakehouse-responses.types';
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

  async getEntityMetadataByAlertId(alertId: number, tenantId: string, userJwt?: string): Promise<EntityMetadataResponse> {
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

      const entitySQL = `
        SELECT 
        DISTINCT 
        td.debtor_Id, 
        td.debtor_account_id, 
        td.debtor_name, 
        td.creditor_id, 
        td.creditor_account_id, 
        td.creditor_name 
        FROM transaction_detail td 
        WHERE td.end_to_end_id = $1 AND td.tenant_id = $2 AND td.tx_type = 'pacs.008.001.10'
        `;
      const entityMetadataResp = await this.runSqlQuery(entitySQL, 1, [referenceId, tenantId], userJwt);
      const entityMetadataRow = entityMetadataResp.data?.[0];
      const entityMetadata = {
        debtorId: entityMetadataRow?.debtor_Id,
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

  /**
   * Removes the metadata suffix (e.g., MSISDN...) from an account ID.
   * Example: '1234567890MSISDNfsp001' → '1234567890'
   */
  private cleanAccountId(rawAccountId: string): string {
    if (!rawAccountId) {
      return rawAccountId;
    }

    // Remove everything starting with 'MSISDN' suffix
    const msisdnIndex = rawAccountId.indexOf('MSISDN');
    if (msisdnIndex !== -1) {
      return rawAccountId.substring(0, msisdnIndex);
    }

    return rawAccountId;
  }

  // Builds an empty graph response for an entity with no associated accounts or transactions

  private buildEmptyEntityGraph(entityId: string, tenantId: string, granularity: string): AccountNodeFullDataResponse {
    return {
      network: {
        rootNodeId: entityId,
        nodes: [
          {
            id: entityId,
            type: 'ENTITY',
            label: entityId,
            flags: { alerted: false, investigated: false },
          },
        ],
        edges: [],
      },
      accountDetails: {
        accountId: entityId,
        accountHolder: 'Unknown',
        relationship: 'Entity',
        transactions: 0,
        totalValue: 0,
        velocity: 'LOW',
        flags: {
          alerted: false,
          investigated: false,
        },
      },
      meta: {
        tenantId,
        granularity,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper function to add or update a node in the nodes map
   */
  private upsertNode(nodesMap: Map<string, NetworkNode>, id: string, nodeType: string, row: any): void {
    if (nodesMap.has(id)) {
      const node = nodesMap.get(id)!;
      node.flags.alerted ||= row.is_alerted_edge === 1;
      node.flags.investigated ||= row.is_investigated_edge === 1;
    } else {
      nodesMap.set(id, {
        id,
        type: nodeType,
        label: id,
        flags: {
          alerted: row.is_alerted_edge === 1,
          investigated: row.is_investigated_edge === 1,
        },
      });
    }
  }

  private processNetworkRows(
    networkRows: any[],
    entityId: string,
    nodeType = 'ACCOUNT',
    fromField = 'from_account_id',
    toField = 'to_account_id',
  ): { nodesMap: Map<string, NetworkNode>; edges: NetworkEdge[] } {
    const nodesMap = new Map<string, NetworkNode>();
    const edges: NetworkEdge[] = [];

    for (const r of networkRows) {
      const fromId = r[fromField];
      const toId = r[toField];

      this.upsertNode(nodesMap, fromId, nodeType, r);
      this.upsertNode(nodesMap, toId, nodeType, r);

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

    return { nodesMap, edges };
  }

  async getAccountNodeFullData(
    entityId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    userJwt?: string,
  ): Promise<AccountNodeFullDataResponse> {
    try {
      const enhancedEntityId = `${entityId}TAZAMA_EID`;

      //Query account_holder table to fetch associated accounts
      const accountHolderSql = `
        SELECT *
        FROM account_holder ah
        WHERE ah.source = $1
          AND ah.tenant_id = $2
      `;

      const accountHolderResp = await this.runSqlQuery(accountHolderSql, 100, [enhancedEntityId, tenantId], userJwt);
      const accountHolderRows = accountHolderResp.data ?? [];

      //Extract and clean account IDs
      const cleanedAccountIds = accountHolderRows
        .map((row) => row.destination)
        .filter((accountId) => accountId)
        .map((accountId) => this.cleanAccountId(accountId));

      if (cleanedAccountIds.length === 0) {
        this.logger.warn(`No accounts found for entity ${entityId} (enhanced: ${enhancedEntityId})`);
        return this.buildEmptyEntityGraph(entityId, tenantId, granularity);
      }

      //Fetch transactions for each account (parallel queries)
      const nodesMap = new Map<string, NetworkNode>();
      const edges: NetworkEdge[] = [];

      // Add entity as root node
      nodesMap.set(entityId, {
        id: entityId,
        type: 'ENTITY',
        label: entityId,
        flags: { alerted: false, investigated: false },
      });

      const accountPlaceholders = cleanedAccountIds.map((_, i) => `$${i + 3}`).join(', ');

      const networkSql = `SELECT from_account_id, to_account_id, tx_count, total_amount, currency_hint, first_event_ts, last_event_ts, is_alerted_edge, is_investigated_edge FROM tx_network_accounts_edges WHERE tenant_id = $1 AND bucket_granularity = $2 AND ( from_account_id IN (${accountPlaceholders}) OR to_account_id IN (${accountPlaceholders}) )`;

      const networkResp = await this.runSqlQuery(networkSql, 1000, [tenantId, granularity, cleanedAccountIds], userJwt);
      const networkRows = (networkResp.data ?? []).map((r) => this.stripHudiMetadata(r));
      const result = this.processNetworkRows(networkRows, entityId, 'ACCOUNT', 'from_account_id', 'to_account_id');

      // Add processed nodes and edges
      result.nodesMap.forEach((value, key) => {
        nodesMap.set(key, value);
      });
      edges.push(...result.edges);
      // Calculate aggregate metrics
      const totalTransactions = edges.reduce((sum, edge) => sum + edge.txCount, 0);
      const totalValue = edges.reduce((sum, edge) => sum + edge.totalAmount, 0);

      const velocity: 'HIGH' | 'MEDIUM' | 'LOW' = totalTransactions >= 50 ? 'HIGH' : totalTransactions >= 10 ? 'MEDIUM' : 'LOW';

      // Check if any node is alerted or investigated
      const rootNode = nodesMap.get(entityId);

      return {
        network: {
          rootNodeId: entityId,
          nodes: Array.from(nodesMap.values()),
          edges,
        },
        accountDetails: {
          accountId: entityId,
          accountHolder: 'Entity',
          relationship: 'Primary Entity',
          transactions: totalTransactions,
          totalValue,
          velocity,
          flags: {
            alerted: rootNode?.flags.alerted ?? false,
            investigated: rootNode?.flags.investigated ?? false,
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
      this.logger.error(`Error fetching entity network data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch entity network and details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCounterpartyNodeFullData(
    counterpartyId: string,
    tenantId: string,
    granularity: 'day' | 'month' | 'year' = 'month',
    userJwt?: string,
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
      WHERE tenant_id = $1
        AND bucket_granularity = $2
        AND (
          from_counterparty_id = $3
          OR to_counterparty_id = $3
        )
    `;

      const networkResp = await this.runSqlQuery(networkSql, 1000, [tenantId, granularity, counterpartyId], userJwt);
      const networkRows = (networkResp.data ?? []).map((r) => this.stripHudiMetadata(r));

      // Add root counterparty node first
      const initialNodesMap = new Map<string, any>();
      initialNodesMap.set(counterpartyId, {
        id: counterpartyId,
        type: 'COUNTERPARTY',
        label: counterpartyId,
        flags: { alerted: false, investigated: false },
      });

      // Process network rows using refactored function
      const { nodesMap: processedNodes, edges } = this.processNetworkRows(
        networkRows,
        counterpartyId,
        'COUNTERPARTY',
        'from_counterparty_id',
        'to_counterparty_id',
      );

      // Merge initial root node with processed nodes
      const nodesMap = new Map(initialNodesMap);
      processedNodes.forEach((value, key) => {
        if (nodesMap.has(key)) {
          const existingNode = nodesMap.get(key)!;
          if (value.flags.alerted) {
            existingNode.flags.alerted = true;
          }
          if (value.flags.investigated) {
            existingNode.flags.investigated = true;
          }
        } else {
          nodesMap.set(key, value);
        }
      });

      const metricsSql = `
      SELECT
        SUM(tx_count) AS transactions,
        SUM(total_amount) AS total_value,
        MAX(is_alerted_edge) AS is_alerted,
        MAX(is_investigated_edge) AS is_investigated
      FROM tx_network_counterparties_edges
      WHERE tenant_id = $1
        AND bucket_granularity = $2
        AND (
          from_counterparty_id = $3
          OR to_counterparty_id = $3
        )
    `;

      const metricsResp = await this.runSqlQuery(metricsSql, 1, [tenantId, granularity, counterpartyId], userJwt);
      const metrics = this.stripHudiMetadata(metricsResp.data?.[0] ?? {});

      const nameSql = `
      SELECT DISTINCT debtor_name AS holder_name
      FROM transaction_detail td
      JOIN counterparty_account_links cal ON td.debtor_account_id = cal.account_id
      WHERE td.tenant_id = $1
        AND cal.counterparty_id = $2
      LIMIT 1
    `;

      const nameResp = await this.runSqlQuery(nameSql, 1, [tenantId, counterpartyId], userJwt);
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
