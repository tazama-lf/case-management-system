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

      const referenceIdData = await this.alertRepository.getReferenceId(alert.txtp, tenantId);
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
        frequency: '-',
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
   * How often transactions occur, e.g. '3.2/day' - a rate distinct from the HIGH/MEDIUM/LOW
   * velocity bucket. Falls back to a single-day window when there aren't two distinct
   * timestamps to measure a span from.
   */
  private formatFrequency(txCount: number, firstEventTs?: string, lastEventTs?: string): string {
    if (!txCount || txCount <= 0) return '-';

    const start = firstEventTs ? new Date(firstEventTs).getTime() : NaN;
    const end = lastEventTs ? new Date(lastEventTs).getTime() : NaN;

    let days = 1;
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      days = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    }

    const rate = txCount / days;
    const rounded = rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10;
    return `${rounded}/day`;
  }

  /**
   * Helper function to add or update a node in the nodes map
   */
  private upsertNode(nodesMap: Map<string, NetworkNode>, id: string, nodeType: string, row: any): void {
    const rowDegree = Number(row.degree ?? 1);

    if (nodesMap.has(id)) {
      const node = nodesMap.get(id)!;
      node.flags.alerted ||= row.is_alerted_edge === 1;
      node.flags.investigated ||= row.is_investigated_edge === 1;
      node.degree = Math.min(node.degree ?? rowDegree, rowDegree);
    } else {
      nodesMap.set(id, {
        id,
        type: nodeType,
        label: id,
        degree: rowDegree,
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

      const txCount = Number(r.tx_count ?? 0);

      edges.push({
        source: fromId,
        target: toId,
        txCount,
        totalAmount: Number(r.total_amount ?? 0),
        currency: r.currency_hint,
        firstEventTs: r.first_event_ts,
        lastEventTs: r.last_event_ts,
        degree: Number(r.degree ?? 1),
        relationship: 'Transaction Flow',
        frequency: this.formatFrequency(txCount, r.first_event_ts, r.last_event_ts),
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

      //Extract, clean and de-duplicate account IDs held by this counterparty
      const rawAccountIds: string[] = accountHolderRows
        .map((row) => row.destination)
        .filter((accountId): accountId is string => Boolean(accountId));
      const cleanedAccountIds: string[] = Array.from(new Set(rawAccountIds.map((accountId) => this.cleanAccountId(accountId))));

      if (cleanedAccountIds.length === 0) {
        this.logger.warn(`No accounts found for entity ${entityId} (enhanced: ${enhancedEntityId})`);
        return this.buildEmptyEntityGraph(entityId, tenantId, granularity);
      }

      // Pull every transaction each linked account was party to, so per-account stats reflect
      // that account's activity across the whole network - not just among the counterparty's own accounts.
      const accountPlaceholders = cleanedAccountIds.map((_, i) => `$${i + 3}`).join(', ');

      const networkSql = `SELECT from_account_id, to_account_id, tx_count, total_amount, currency_hint, first_event_ts, last_event_ts, is_alerted_edge, is_investigated_edge FROM tx_network_accounts_edges WHERE tenant_id = $1 AND bucket_granularity = $2 AND ( from_account_id IN (${accountPlaceholders}) OR to_account_id IN (${accountPlaceholders}) )`;

      const networkResp = await this.runSqlQuery(networkSql, 1000, [tenantId, granularity, ...cleanedAccountIds], userJwt);
      const networkRows = (networkResp.data ?? []).map((r) => this.stripHudiMetadata(r));

      // Aggregate each held account's own transaction numbers/values/flags across every
      // transaction it appears in (whether the other side is a sibling account or an external one).
      const heldAccountIds = new Set(cleanedAccountIds);
      const accountStats = new Map<
        string,
        {
          txCount: number;
          totalAmount: number;
          currencies: Set<string>;
          alerted: boolean;
          investigated: boolean;
          firstEventTs?: string;
          lastEventTs?: string;
        }
      >();

      const getStats = (accountId: string) => {
        if (!accountStats.has(accountId)) {
          accountStats.set(accountId, { txCount: 0, totalAmount: 0, currencies: new Set(), alerted: false, investigated: false });
        }
        return accountStats.get(accountId)!;
      };

      for (const r of networkRows) {
        const txCount = Number(r.tx_count ?? 0);
        const totalAmount = Number(r.total_amount ?? 0);
        const alerted = r.is_alerted_edge === 1;
        const investigated = r.is_investigated_edge === 1;

        for (const accountId of [r.from_account_id, r.to_account_id]) {
          if (!heldAccountIds.has(accountId)) continue;
          const stats = getStats(accountId);
          stats.txCount += txCount;
          stats.totalAmount += totalAmount;
          if (r.currency_hint) stats.currencies.add(r.currency_hint);
          stats.alerted ||= alerted;
          stats.investigated ||= investigated;
          if (r.first_event_ts && (!stats.firstEventTs || r.first_event_ts < stats.firstEventTs)) {
            stats.firstEventTs = r.first_event_ts;
          }
          if (r.last_event_ts && (!stats.lastEventTs || r.last_event_ts > stats.lastEventTs)) {
            stats.lastEventTs = r.last_event_ts;
          }
        }
      }

      // The counterparty is the root/center node; the "account holder relationship" links below
      // are what connect it to every account it holds.
      const rootFlags = { alerted: false, investigated: false };
      accountStats.forEach((stats) => {
        rootFlags.alerted ||= stats.alerted;
        rootFlags.investigated ||= stats.investigated;
      });

      const nodesMap = new Map<string, NetworkNode>();
      nodesMap.set(entityId, {
        id: entityId,
        type: 'ENTITY',
        label: entityId,
        flags: rootFlags,
      });

      const edges: NetworkEdge[] = cleanedAccountIds.map((accountId) => {
        const stats = accountStats.get(accountId);
        const currency = stats && stats.currencies.size === 1 ? Array.from(stats.currencies)[0] : undefined;
        const flags = { alerted: stats?.alerted ?? false, investigated: stats?.investigated ?? false };

        nodesMap.set(accountId, {
          id: accountId,
          type: 'ACCOUNT',
          label: accountId,
          flags,
        });

        return {
          source: entityId,
          target: accountId,
          txCount: stats?.txCount ?? 0,
          totalAmount: stats?.totalAmount ?? 0,
          currency,
          firstEventTs: stats?.firstEventTs,
          lastEventTs: stats?.lastEventTs,
          relationship: 'Account Holder Relationship',
          frequency: this.formatFrequency(stats?.txCount ?? 0, stats?.firstEventTs, stats?.lastEventTs),
          flags,
        };
      });

      // Calculate aggregate metrics for the counterparty itself. This is summed from the raw
      // transaction rows (not the per-account edges above) so a transaction between two of the
      // counterparty's own accounts is counted once, not twice.
      const totalTransactions = networkRows.reduce((sum, r) => sum + Number(r.tx_count ?? 0), 0);
      const totalValue = networkRows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);

      let networkFirstEventTs: string | undefined;
      let networkLastEventTs: string | undefined;
      for (const r of networkRows) {
        if (r.first_event_ts && (!networkFirstEventTs || r.first_event_ts < networkFirstEventTs)) {
          networkFirstEventTs = r.first_event_ts;
        }
        if (r.last_event_ts && (!networkLastEventTs || r.last_event_ts > networkLastEventTs)) {
          networkLastEventTs = r.last_event_ts;
        }
      }

      const velocity: 'HIGH' | 'MEDIUM' | 'LOW' = totalTransactions >= 50 ? 'HIGH' : totalTransactions >= 10 ? 'MEDIUM' : 'LOW';
      const frequency = this.formatFrequency(totalTransactions, networkFirstEventTs, networkLastEventTs);

      return {
        network: {
          rootNodeId: entityId,
          nodes: Array.from(nodesMap.values()),
          edges,
        },
        accountDetails: {
          accountId: entityId,
          accountHolder: 'Counterparty',
          relationship: 'Counterparty',
          transactions: totalTransactions,
          totalValue,
          velocity,
          frequency,
          flags: rootFlags,
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
        WITH first_degree AS (
          SELECT
            CASE
              WHEN from_counterparty_id = $3 THEN to_counterparty_id
              ELSE from_counterparty_id
            END AS counterparty_id
          FROM tx_network_counterparties_edges
          WHERE tenant_id = $1
            AND bucket_granularity = $2
            AND (
              from_counterparty_id = $3
              OR to_counterparty_id = $3
            )
        ),
        network_seeds AS (
          SELECT $3 AS counterparty_id
          UNION
          SELECT counterparty_id FROM first_degree
        )
        SELECT
          from_counterparty_id,
          to_counterparty_id,
          tx_count,
          total_amount,
          currency_hint,
          first_event_ts,
          last_event_ts,
          is_alerted_edge,
          is_investigated_edge,
          CASE
            WHEN from_counterparty_id = $3 OR to_counterparty_id = $3 THEN 1
            ELSE 2
          END AS degree
        FROM tx_network_counterparties_edges
        WHERE tenant_id = $1
          AND bucket_granularity = $2
          AND (
            from_counterparty_id IN (SELECT counterparty_id FROM network_seeds)
            OR to_counterparty_id IN (SELECT counterparty_id FROM network_seeds)
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
        degree: 0,
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

      const counterpartyIds = Array.from(nodesMap.keys());
      const counterpartyNamesMap = new Map<string, string>();

      if (counterpartyIds.length > 0) {
        const counterpartyPlaceholders = counterpartyIds.map((_, index) => `$${index + 2}`).join(', ');
        const namesSql = `
          SELECT DISTINCT
            cal.counterparty_id,
            CASE
              WHEN cal.counterparty_id LIKE 'dbtr_%' THEN td.debtor_name
              WHEN cal.counterparty_id LIKE 'cdtr_%' THEN td.creditor_name
              ELSE COALESCE(td.debtor_name, td.creditor_name)
            END AS holder_name
          FROM counterparty_account_links cal
          LEFT JOIN transaction_detail td ON (
            (cal.counterparty_id LIKE 'dbtr_%' AND td.debtor_account_id = cal.account_id)
            OR (cal.counterparty_id LIKE 'cdtr_%' AND td.creditor_account_id = cal.account_id)
          )
          WHERE cal.tenant_id = $1
            AND cal.counterparty_id IN (${counterpartyPlaceholders})
            AND (td.tenant_id = $1 OR td.tenant_id IS NULL)
        `;

        const namesResp = await this.runSqlQuery(namesSql, 1000, [tenantId, ...counterpartyIds], userJwt);
        const namesRows = (namesResp.data ?? []).map((r) => this.stripHudiMetadata(r));

        for (const row of namesRows) {
          if (row.counterparty_id && row.holder_name && !counterpartyNamesMap.has(row.counterparty_id)) {
            counterpartyNamesMap.set(row.counterparty_id, row.holder_name);
          }
        }

        nodesMap.forEach((node, nodeId) => {
          const name = counterpartyNamesMap.get(nodeId);
          if (name) {
            node.name = name;
            node.label = name;
          }
        });
      }

      const metricsSql = `
      SELECT
        SUM(tx_count) AS transactions,
        SUM(total_amount) AS total_value,
        MAX(is_alerted_edge) AS is_alerted,
        MAX(is_investigated_edge) AS is_investigated,
        MIN(first_event_ts) AS first_event_ts,
        MAX(last_event_ts) AS last_event_ts
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
      const frequency = this.formatFrequency(txCount, metrics.first_event_ts, metrics.last_event_ts);
      const centerNode = nodesMap.get(counterpartyId);
      const centerName = counterpartyNamesMap.get(counterpartyId) ?? nameRow?.holder_name ?? counterpartyId;

      if (centerNode) {
        centerNode.name = centerName;
        centerNode.label = centerName;
      }

      return {
        network: {
          rootNodeId: counterpartyId,
          nodes: Array.from(nodesMap.values()),
          edges,
        },
        counterpartyDetails: {
          counterpartyId,
          name: centerName,
          type: 'Business',
          transactions: txCount,
          totalValue: Number(metrics.total_value ?? 0),
          velocity,
          frequency,
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
