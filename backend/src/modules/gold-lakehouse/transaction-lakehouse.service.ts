import { Injectable, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
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
import { TransactionDetailDataResponse } from './types/transaction-detail.types';
import { GenerateProfileResponseDto } from './dto/profile-response.dto';
import { AlertRepository } from '../repository/alert.repository';
import { JsonValue } from '../repository/utils/types/JsonValue';
import { extractReferenceId } from '../repository/utils/extractReferenceId';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import type { TransactionHistoryResponse } from './types/transaction-history-response.types';

@Injectable()
export class TransactionLakehouseService extends GoldLakehouseService {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    private readonly alertRepository: AlertRepository,
  ) {
    super(httpService, configService);
  }

  async getTransactionDetailData(endToEndId: string, tenantId = 'DEFAULT', userJwt?: string): Promise<TransactionDetailDataResponse> {
    try {
      this.logger.log(`Fetching Transaction Detail UI data for transaction: ${endToEndId}`);

      const response = await this.query(
        {
          table_name: 'transaction_detail',
          filters: {
            end_to_end_id: endToEndId,
            tenant_id: tenantId,
          },
          columns: [
            'transaction_id',
            'tx_msg_id',
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
        },
        userJwt,
      );

      if (response.data.length === 0) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      // Destructure pacs8 and pacs2 from response data
      const pacs8 = response.data.find((record) => record.tx_type === 'pacs.008.001.10');
      const pacs2 = response.data.find((record) => record.tx_type === 'pacs.002.001.12');

      if (!pacs8) {
        throw new HttpException('pacs.008 transaction not found', HttpStatus.NOT_FOUND);
      }
      if (!pacs2) {
        throw new HttpException('pacs.002 transaction not found', HttpStatus.NOT_FOUND);
      }

      // Transform to frontend-expected format
      return {
        transactionOverview: {
          pacs8: {
            transactionId: String(pacs8.tx_msg_id),
            transactionType: String(pacs8.tx_type),
            timestamp: String(pacs8.tx_event_ts),
          },
          pacs2: {
            transactionId: String(pacs2.tx_msg_id),
            transactionType: String(pacs2.tx_type),
            timestamp: String(pacs2.tx_event_ts),
          },
        },
        transactionFlow: {
          debtor: {
            name: String(pacs8.debtor_name),
            account: {
              iban: String(pacs8.debtor_account_id),
            },
            bank: String(pacs8.instd_mmb_id),
          },
          amount: {
            amount: Number(pacs8.interbank_settlement_amount),
            currency: String(pacs8.interbank_settlement_currency) || 'USD',
          },
          creditor: {
            name: String(pacs8.creditor_name),
            account: {
              iban: String(pacs8.creditor_account_id),
            },
            bankName: String(pacs8.instg_mmb_id),
          },
        },
        debtorProfile: {
          name: String(pacs8.debtor_name),
          account: {
            iban: String(pacs8.debtor_account_id),
          },
          bank: String(pacs8.instd_mmb_id),
        },
        creditorProfile: {
          name: String(pacs8.creditor_name),
          account: {
            iban: String(pacs8.creditor_account_id),
          },
          bank: String(pacs8.instg_mmb_id),
        },
        amountAndCurrency: [
          {
            originalAmount: Number(pacs8.instructed_amount) || 0,
            exchangeRate: Number(pacs8.exchange_rate) || 1,
            convertedAmount: Number(pacs8.interbank_settlement_amount) || 0,
          },
          {
            totalCharges: Number(pacs8.charge_total_amount),
          },
        ],
        settlementDetails: {
          settlementDate: String(pacs8.tx_event_date),
          reference: String(pacs8.transaction_id),
          purpose: '',
        },
        links: [
          {
            rel: 'self',
            href: `/api/v1/lakehouse/transaction-detail/${endToEndId}?tenantId=${tenantId}`,
          },
        ],
      };
    } catch (error: unknown) {
      // Re-throw HttpExceptions as-is to preserve specific error messages
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction Detail data: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to fetch Transaction Detail data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionHistoryByAccountId(
    accountId: string,
    tenantId: string,
    startDate?: string,
    endDate?: string,
    granularity?: string,
    userJwt?: string,
  ): Promise<TransactionHistoryResponse> {
    try {
      this.logger.log(`Start - getTransactionHistoryByAccountId: ${accountId}`);

      // Query 1: Fetch EVENT rows with transaction details
      const eventsResponse = await this.runSqlQuery(
        `
        SELECT DISTINCT th.end_to_end_id, th.tx_msg_id, th.end_to_end_id, th.transaction_id, th.event_date, th.tx_amount, th.tx_ccy, th.tx_type, th.is_alerted, th.is_investigated, th.cum_tx_count, th.cum_tx_amount, th.entity_role, td.debtor_name, td.creditor_name FROM transaction_history th LEFT JOIN transaction_detail td ON th.transaction_id = td.transaction_id AND th.tenant_id = td.tenant_id WHERE th.row_type = 'EVENT' AND th.entity_id = $1 AND th.tenant_id = $2 AND td.debtor_name IS NOT NULL AND td.creditor_name IS NOT NULL ORDER BY th.event_date DESC
        `,
        1000,
        [accountId, tenantId],
        userJwt,
      );

      // Query 2: Fetch AGG rows for volume distribution (if granularity provided)
      let aggregates: any[] = [];
      if (granularity) {
        const aggResponse = await this.runSqlQuery(
          `
          SELECT 
            bucket_start,
            bucket_tx_count,
            bucket_tx_amount,
            bucket_granularity
          FROM transaction_history
          WHERE row_type = 'AGG'
            AND entity_id = $1
            AND bucket_granularity = $2
            AND tenant_id = $3
          ORDER BY bucket_start ASC
          `,
          1000,
          [accountId, granularity, tenantId],
          userJwt,
        );
        aggregates = (aggResponse?.data ?? []).map((a) => this.stripHudiMetadata(a));
      }

      const events = (eventsResponse?.data ?? []).map((e) => this.stripHudiMetadata(e));

      if (events.length === 0) {
        this.logger.warn(`No transaction history found for account: ${accountId}`);
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
          WHERE account_id = $1
            AND tenant_id = $2
          `,
          100,
          [accountId, tenantId],
          userJwt,
        );
        const baseline = baselineResponse?.data?.[0];
        if (baseline) {
          const baselineData = this.stripHudiMetadata(baseline);
          expectedTxCount = parseInt(baselineData.total_tx_count, 10) || null;
          expectedVolume = parseFloat(baselineData.total_amount) || null;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch baseline data for account: ${accountId}`);
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
      const bucketTotalTransactions = aggregates.reduce((sum, a) => sum + (parseInt(a.bucket_tx_count, 10) || 0), 0);

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

      const cumulative = events
        .map((e) => ({
          date: e.event_date,
          cumulativeAmount: parseFloat(e.cum_tx_amount) || 0,
          cumulativeCount: parseInt(e.cum_tx_count, 10) || 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const volumeDistribution = aggregates.map((a) => ({
        bucketStart: a.bucket_start,
        granularity: a.bucket_granularity,
        transactionCount: parseInt(a.bucket_tx_count, 10) || 0,
        totalVolume: parseFloat(a.bucket_tx_amount) || 0,
      }));

      const recentTransactions = events.slice(0, 20).map((e) => {
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
          accountId,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction History by entity_id: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Transaction History by entity_id', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionNetworkData(
    accountId: string,
    tenantId: string,
    timeRange: string,
    userJwt?: string,
  ): Promise<TransactionNetworkResponseDto> {
    try {
      this.logger.log(`Fetching transaction network for account: ${accountId}, timeRange: ${timeRange}`);

      const centerAccountSql = `
        SELECT DISTINCT 
          COALESCE(debtor_account_id, creditor_account_id) as account_id,
          COALESCE(debtor_name, creditor_name) as account_name
        FROM transaction_detail
        WHERE (debtor_account_id = $1 OR creditor_account_id = $1)
          AND tenant_id = $2
        LIMIT 1
      `;

      const centerAccountResponse = await this.runSqlQuery(centerAccountSql, 1, [accountId, tenantId], userJwt);
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
        WHERE debtor_account_id = $1
          AND tenant_id = $2
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
        WHERE creditor_account_id = $1
          AND tenant_id = $2
        GROUP BY debtor_account_id, debtor_name
      `;

      const alertFlagsSql = `
        SELECT
          MAX(COALESCE(is_alerted, 0))      as is_alerted,
          MAX(COALESCE(is_investigated, 0)) as is_investigated
        FROM transaction_history
        WHERE entity_id = $1
          AND tenant_id = $2
          AND row_type = 'AGG'
      `;

      const [outboundResponse, inboundResponse, alertFlagsResponse] = await Promise.all([
        this.runSqlQuery(outboundSql, 1000, [accountId, tenantId], userJwt),
        this.runSqlQuery(inboundSql, 1000, [accountId, tenantId], userJwt),
        this.runSqlQuery(alertFlagsSql, 10, [accountId, tenantId], userJwt),
      ]);

      const outboundData = (outboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const inboundData = (inboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const centerAccountFlags = alertFlagsResponse?.data?.[0] ? this.stripHudiMetadata(alertFlagsResponse.data[0]) : null;
      const centerAccountIsAlerted = centerAccountFlags ? centerAccountFlags.is_alerted === 1 : false;
      const centerAccountIsInvestigated = centerAccountFlags ? centerAccountFlags.is_investigated === 1 : false;

      const allConnections = [...outboundData, ...inboundData];

      const connectedAccounts: ConnectedAccountDto[] = allConnections.map((conn) => {
        const velocity = this.calculateVelocity(Number(conn.total_transactions), Math.max(Number(conn.duration_days), 1));

        // Mark connected accounts with hasAlert when the center account has alerts
        const hasAlert = centerAccountIsAlerted || centerAccountIsInvestigated;

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
          alertMessage:
            centerAccountIsAlerted || centerAccountIsInvestigated ? 'Center account has alerts — check transaction history' : undefined,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching transaction network data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch transaction network data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCounterpartyNetworkData(
    accountId: string,
    tenantId: string,
    timeRange = '30d',
    userJwt?: string,
  ): Promise<CounterpartyNetworkResponseDto> {
    try {
      this.logger.log(`Fetching counterparty network for account: ${accountId}`);

      const accountHolderSql = `
        SELECT 
          debtor_name,
          creditor_name,
          debtor_account_id,
          creditor_account_id
        FROM transaction_detail
        WHERE (debtor_account_id = $1 OR creditor_account_id = $1)
          AND tenant_id = $2
        LIMIT 1
      `;

      const accountHolderResponse = await this.runSqlQuery(accountHolderSql, 1, [accountId, tenantId], userJwt);
      const accountRow = accountHolderResponse?.data?.[0];

      if (!accountRow) {
        throw new HttpException('Account not found in transactions', HttpStatus.NOT_FOUND);
      }

      const account = this.stripHudiMetadata(accountRow);
      const accountHolder = account.debtor_account_id === accountId ? account.debtor_name : account.creditor_name;

      const counterpartyLinksSql = `
        SELECT DISTINCT counterparty_id
        FROM counterparty_account_links
        WHERE account_id = $1
          AND tenant_id = $2
        LIMIT 1
      `;

      const counterpartyLinksResponse = await this.runSqlQuery(counterpartyLinksSql, 1, [accountId, tenantId], userJwt);
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
        WHERE (from_counterparty_id = $1 
           OR to_counterparty_id = $1)
          AND tenant_id = $2
      `;

      const edgesResponse = await this.runSqlQuery(networkEdgesSql, 1000, [centerCounterpartyId, tenantId], userJwt);
      const edges = (edgesResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));

      const allCounterpartyIds = new Set<string>([centerCounterpartyId]);
      edges.forEach((edge) => {
        allCounterpartyIds.add(edge.from_counterparty_id);
        allCounterpartyIds.add(edge.to_counterparty_id);
      });

      const counterpartyNamesMap = new Map<string, string>();

      // Optimize: Get all counterparty names in a single query instead of N+1 queries
      if (allCounterpartyIds.size > 0) {
        const counterpartyIdsArray = Array.from(allCounterpartyIds);
        const counterpartyPlaceholders = counterpartyIdsArray.map((_, idx) => `$${idx + 1}`).join(',');

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
          WHERE cal.counterparty_id IN (${counterpartyPlaceholders})
            AND cal.tenant_id = $${counterpartyIdsArray.length + 1}
            AND td.tenant_id = $${counterpartyIdsArray.length + 1}
        `;

        const namesResponse = await this.runSqlQuery(namesSql, 1000, [...counterpartyIdsArray, tenantId], userJwt);
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
        const edgeKey = [edge.from_counterparty_id, edge.to_counterparty_id].sort((a, b) => a.localeCompare(b)).join('->');
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching counterparty network data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch counterparty network data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateProfile(
    alertId: number,
    dto: GenerateProfileDto,
    userId: string,
    tenantId: string,
    userJwt?: string,
  ): Promise<GenerateProfileResponseDto> {
    this.logger.log(`Alert ID:  ${alertId}`, GoldLakehouseService.name);

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

      const transactionCreditorSql = `
      SELECT DISTINCT th.tx_msg_id, th.event_date, th.tx_amount, th.tx_ccy, th.tx_type, th.is_alerted, th.is_investigated, th.cum_tx_count, th.cum_tx_amount, th.entity_role, td_src.creditor_name, th.entity_id, th.entity_type FROM transaction_detail td_src INNER JOIN transaction_history th ON th.entity_id IN (td_src.creditor_id) AND th.tenant_id = td_src.tenant_id AND th.row_type = 'EVENT' WHERE td_src.end_to_end_id = $1 AND td_src.tenant_id = $2 AND td_src.tx_type = 'pacs.008.001.10' ORDER BY th.event_date DESC`;

      const transactionCreditorResp = await this.runSqlQuery(transactionCreditorSql, 1000, [referenceId, tenantId], userJwt);

      const transactionDebtorSql = `
      SELECT DISTINCT th.tx_msg_id, th.event_date, th.tx_amount, th.tx_ccy, th.tx_type, th.is_alerted, th.is_investigated, th.cum_tx_count, th.cum_tx_amount, th.entity_role, td_src.debtor_name, th.entity_id, th.entity_type FROM transaction_detail td_src INNER JOIN transaction_history th ON th.entity_id IN (td_src.debtor_id) AND th.tenant_id = td_src.tenant_id AND th.row_type = 'EVENT' WHERE td_src.end_to_end_id = $1 AND td_src.tenant_id = $2 AND td_src.tx_type = 'pacs.008.001.10' ORDER BY th.event_date DESC`;

      const transactionDebtorResp = await this.runSqlQuery(transactionDebtorSql, 1000, [referenceId, tenantId], userJwt);
      return {
        tenantId,
        transactionCreditorResp,
        transactionDebtorResp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error generating profile for Alert ID ${alertId}: ${errorMessage}`, errorStack, GoldLakehouseService.name);
      throw new InternalServerErrorException(`Failed to generate profile for Alert ID ${alertId}`);
    }
  }
}
