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
import { Cumulative, RecentTransaction, Timeline } from './types/gold-lakehouse.types';
import {
  TestAccountIdsResponse,
  TransactionHistoryByEndToEndIdResponse,
  TransactionPerspectivesResponse,
} from './types/gold-lakehouse-responses.types';
import { TransactionDetailDataResponse, TransactionOverviewUIDataResponse } from './types/transaction-detail.types';
import { GenerateProfileResponseDto } from './dto/profile-response.dto';
import { AlertRepository } from '../repository/alert.repository';
import { JsonValue } from '../repository/utils/types/JsonValue';
import { extractReferenceId } from '../repository/utils/extractReferenceId';
import { GenerateProfileDto } from './dto/generate-profile.dto';

@Injectable()
export class TransactionLakehouseService extends GoldLakehouseService {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    private readonly alertRepository: AlertRepository,
  ) {
    super(httpService, configService);
  }

  async getTransactionDetailData(endToEndId: string, tenantId = 'DEFAULT'): Promise<TransactionDetailDataResponse> {
    try {
      this.logger.log(`Fetching Transaction Detail UI data for transaction: ${endToEndId}`);

      const response = await this.query({
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
      });

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

  async getTransactionOverviewUIData(transactionId: number, tenantId = 'DEFAULT'): Promise<TransactionOverviewUIDataResponse> {
    try {
      this.logger.log(`Fetching Transaction Overview UI data for ID: ${transactionId}`);

      const response = await this.runSqlQuery(
        `
      SELECT
        transaction_id,
        end_to_end_id,
        tx_type,
        tx_event_ts,
        tx_event_date,
        debtor_id,
        debtor_name,
        debtor_account_id,
        creditor_id,
        creditor_name,
        creditor_account_id,
        instg_mmb_id,
        instd_mmb_id,
        interbank_settlement_amount,
        interbank_settlement_currency,
        instructed_amount,
        instructed_currency,
        exchange_rate,
        charge_total_amount,
        charge_currency,
        tenant_id
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

      const mapField = (field: string): string | null | number => {
        if (!(field in row)) {
          return 'no mapping found';
        }
        return row[field] === null ? null : row[field];
      };

      return {
        transactionOverview: {
          transactionId: String(mapField('transaction_id') ?? ''),
          timestamp: String(mapField('tx_event_ts') ?? ''),
          type: String(mapField('tx_type') ?? ''),
          status: 'no mapping found',
        },

        transactionFlow: {
          amount: Number(mapField('interbank_settlement_amount') ?? 0),
          currency: String(mapField('interbank_settlement_currency') ?? 'USD'),

          debtor: {
            name: String(mapField('debtor_name') ?? ''),
            account: String(mapField('debtor_account_id') ?? ''),
            bank: String(mapField('instd_mmb_id') ?? ''),
          },

          creditor: {
            name: String(mapField('creditor_name') ?? ''),
            account: String(mapField('creditor_account_id') ?? ''),
            bank: String(mapField('instg_mmb_id') ?? ''),
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error building Transaction Overview UI data: ${errorMessage}`, errorStack);

      throw new HttpException('Failed to fetch Transaction Overview data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionHistoryData(
    id: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<unknown> {
    try {
      // Smart detection: Check if ID is a UUID (end_to_end_id) or entity_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iv;
      const isEndToEndId = uuidRegex.test(id);

      if (isEndToEndId) {
        // Query by end_to_end_id - returns all 4 entity perspectives for single transaction
        this.logger.log(`Fetching Transaction History by end_to_end_id: ${id}`);
        return await this.getTransactionHistoryByEndToEndId(id, tenantId, startDate, endDate, granularity);
      } else {
        // Query by entity_id - returns transaction history for entity
        this.logger.log(`Fetching Transaction History by entity_id: ${id}`);
        return await this.getTransactionHistoryByEntityId(id, tenantId, startDate, endDate, granularity);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction History data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Transaction History data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async getTransactionHistoryByEntityId(
    entityId: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<{
    summary: {
      totalVolume: number;
      totalTransactions: number;
      transactionCount: number;
      alertsTriggered: number;
      alertsPercentage: number;
      investigated: number;
      investigatedPercentage: number;
      avgTransactionsPerDay: number;
      durationDays: number;
      bucketTotalVolume: number;
      bucketTotalTransactions: number;
      expected: {
        transactionCount: number | null;
        volume: number | null;
      };
      actual: {
        transactionCount: number;
        volume: number;
      };
    };
    timeline: Timeline[];
    cumulative: Cumulative;
    volumeDistribution: Array<{
      bucketStart: string;
      granularity: string;
      transactionCount: number;
      totalVolume: number;
    }>;
    recentTransactions: RecentTransaction[];
    meta: {
      entityId: string;
      tenantId: string;
      granularity: string | null;
      startDate: string | null;
      endDate: string | null;
      eventRowCount: number;
      aggRowCount: number;
      queryTimestamp: string;
    };
  }> {
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
        aggregates = (aggResponse?.data ?? []).map((a) => this.stripHudiMetadata(a));
      }

      const events = (eventsResponse?.data ?? []).map((e) => this.stripHudiMetadata(e));

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
          expectedTxCount = parseInt(baselineData.total_tx_count, 10) || null;
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

      // Transform cumulative data (sorted by date ascending)
      const cumulative = events
        .map((e) => ({
          date: e.event_date,
          cumulativeAmount: parseFloat(e.cum_tx_amount) || 0,
          cumulativeCount: parseInt(e.cum_tx_count, 10) || 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Transform volume distribution
      const volumeDistribution = aggregates.map((a) => ({
        bucketStart: a.bucket_start,
        granularity: a.bucket_granularity,
        transactionCount: parseInt(a.bucket_tx_count, 10) || 0,
        totalVolume: parseFloat(a.bucket_tx_amount) || 0,
      }));

      // Transform recent transactions table (top 20)
      const recentTransactions = events.slice(0, 20).map((e) => {
        // Determine counterparty based on entity role
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
          entityId,
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

  async getTransactionHistoryByEndToEndId(
    endToEndId: string,
    tenantId = 'DEFAULT',
    startDate?: string,
    endDate?: string,
    granularity?: string,
  ): Promise<TransactionHistoryByEndToEndIdResponse> {
    try {
      this.logger.log(`Fetching Transaction History for end_to_end_id: ${endToEndId}`);

      // Build date filter if provided (though typically not used with end_to_end_id queries)
      const dateFilter = startDate && endDate ? `AND th.event_date BETWEEN '${startDate}' AND '${endDate}'` : '';

      // Query transaction_history for all entity perspectives with row_type='EVENT'
      const eventsResponse = await this.runSqlQuery(
        `
        SELECT 
          th.transaction_id,
          th.end_to_end_id,
          th.entity_type,
          th.entity_role,
          th.entity_id,
          th.entity_name,
          th.event_date,
          th.event_ts,
          th.tx_amount,
          th.tx_ccy,
          th.tx_type,
          th.is_alerted,
          th.is_investigated,
          td.debtor_name,
          td.creditor_name,
          td.debtor_account_id,
          td.creditor_account_id
        FROM transaction_history th
        LEFT JOIN transaction_detail td 
          ON th.transaction_id = td.transaction_id 
          AND th.tenant_id = td.tenant_id
        WHERE th.row_type = 'EVENT'
          AND th.end_to_end_id = '${endToEndId}'
          AND th.tenant_id = '${tenantId}'
          ${dateFilter}
        ORDER BY th.entity_type, th.entity_role
        `,
        10,
      );

      const events = (eventsResponse?.data ?? []).map((e) => this.stripHudiMetadata(e));

      if (events.length === 0) {
        this.logger.warn(`No transaction found for end_to_end_id: ${endToEndId}`);
        return {
          summary: {
            totalVolume: 0,
            totalTransactions: 0,
            transactionCount: 0,
            alertsTriggered: 0,
            alertsPercentage: 0,
            investigated: 0,
            investigatedPercentage: 0,
            avgTransactionsPerDay: 0,
            durationDays: 0,
          },
          timeline: [],
          cumulative: [],
          volumeDistribution: [],
          recentTransactions: [],
          entityPerspectives: [],
          meta: {
            endToEndId,
            tenantId,
            queryType: 'end_to_end_id',
            message: 'No transaction found with this end_to_end_id',
            queryTimestamp: new Date().toISOString(),
          },
        };
      }

      // Build entity perspectives array (using snake_case to match database schema)
      const entityPerspectives = events.map((e) => ({
        entity_type: e.entity_type,
        entity_role: e.entity_role,
        entity_id: e.entity_id,
        entity_name: e.entity_name ?? 'Unknown Entity',
        transaction_id: e.transaction_id,
        tx_amount: parseFloat(e.tx_amount) || 0,
        tx_ccy: e.tx_ccy,
        event_ts: e.event_ts,
      }));

      // Process all events to build summary metrics
      let totalVolume = 0;
      let alertsTriggered = 0;
      let investigatedCount = 0;

      const timeline = events.map((e) => {
        const amount = parseFloat(e.tx_amount) || 0;
        const isAlert = e.is_alerted === 1;
        const isInvest = e.is_investigated === 1;

        totalVolume += amount;
        if (isAlert) alertsTriggered += 1;
        if (isInvest) investigatedCount += 1;

        return {
          transactionId: e.transaction_id,
          date: e.event_ts,
          amount,
          currency: e.tx_ccy,
          type: e.tx_type ?? 'Unknown',
          isAlerted: isAlert,
          isInvestigated: isInvest,
          entityRole: e.entity_role,
          entityType: e.entity_type,
        };
      });

      // Build cumulative data
      let runningAmount = 0;
      const cumulative = events.map((e, index) => {
        const amount = parseFloat(e.tx_amount) || 0;
        runningAmount += amount;
        return {
          date: e.event_ts,
          cumulativeAmount: runningAmount,
          cumulativeCount: index + 1,
        };
      });

      // Build recent transactions table with all perspectives
      const recentTransactions = events.map((e) => {
        const amount = parseFloat(e.tx_amount) || 0;
        const isAlert = e.is_alerted === 1;
        const isInvest = e.is_investigated === 1;

        return {
          transactionId: e.transaction_id,
          date: e.event_ts,
          type: e.tx_type ?? 'Unknown',
          counterparty: e.entity_name ?? 'Unknown',
          role: `${e.entity_type} (${e.entity_role})`,
          amount,
          currency: e.tx_ccy,
          status: [...(isAlert ? ['Alert'] : []), ...(isInvest ? ['Investigated'] : [])],
          actions: {
            viewDetailsLink: `/triage/transaction-detail/${e.transaction_id}`,
          },
        };
      });

      const firstEvent = events[0];

      return {
        summary: {
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalTransactions: events.length,
          transactionCount: events.length,
          alertsTriggered,
          alertsPercentage: (alertsTriggered / events.length) * 100,
          investigated: investigatedCount,
          investigatedPercentage: (investigatedCount / events.length) * 100,
          avgTransactionsPerDay: events.length, // Since it's one day effectively
          durationDays: 1,
          perspectiveCount: events.length,
        },
        timeline,
        cumulative,
        volumeDistribution: [],
        recentTransactions,
        entityPerspectives,
        meta: {
          endToEndId,
          tenantId,
          queryType: 'end_to_end_id',
          transactionId: firstEvent.transaction_id,
          perspectiveCount: events.length,
          debtorName: firstEvent.debtor_name,
          creditorName: firstEvent.creditor_name,
          debtorAccountId: firstEvent.debtor_account_id,
          creditorAccountId: firstEvent.creditor_account_id,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          queryTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction History by end_to_end_id (${endToEndId}): ${errorMessage}`, errorStack);

      // Log additional context for debugging
      this.logger.error(`Query parameters - tenantId: ${tenantId}, startDate: ${startDate}, endDate: ${endDate}`);

      throw new HttpException(`Failed to fetch Transaction History by end_to_end_id: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionPerspectivesByEndToEndId(endToEndId: string, tenantId = 'DEFAULT'): Promise<TransactionPerspectivesResponse> {
    try {
      this.logger.log(`Fetching Transaction Perspectives for end_to_end_id: ${endToEndId}`);

      // Query transaction_history for all entity perspectives with row_type='EVENT'
      const response = await this.runSqlQuery(
        `
        SELECT 
          th.entity_type,
          th.entity_role,
          th.entity_id,
          th.entity_name,
          th.transaction_id,
          th.end_to_end_id,
          th.tx_amount,
          th.tx_ccy,
          th.tx_type,
          th.event_date,
          th.event_ts,
          th.is_alerted,
          th.is_investigated,
          td.debtor_name,
          td.creditor_name,
          td.debtor_account_id,
          td.creditor_account_id
        FROM transaction_history th
        LEFT JOIN transaction_detail td 
          ON th.transaction_id = td.transaction_id 
          AND th.tenant_id = td.tenant_id
        WHERE th.row_type = 'EVENT'
          AND th.end_to_end_id = '${endToEndId}'
          AND th.tenant_id = '${tenantId}'
        ORDER BY th.entity_type, th.entity_role
        `,
        10,
      );

      const perspectives = (response?.data ?? []).map((row) => this.stripHudiMetadata(row));

      if (perspectives.length === 0) {
        this.logger.warn(`No transaction perspectives found for end_to_end_id: ${endToEndId}`);
        return {
          endToEndId,
          tenantId,
          perspectives: [],
          perspectiveCount: 0,
          transactionDetails: null,
          meta: {
            queryTimestamp: new Date().toISOString(),
            message: 'No transaction found with this end_to_end_id',
          },
        };
      }

      // Extract common transaction details from first perspective
      const firstPerspective = perspectives[0];
      const transactionDetails = {
        transactionId: firstPerspective.transaction_id,
        endToEndId: firstPerspective.end_to_end_id,
        amount: parseFloat(firstPerspective.tx_amount) || 0,
        currency: firstPerspective.tx_ccy,
        type: firstPerspective.tx_type ?? 'Unknown',
        date: firstPerspective.event_date,
        timestamp: firstPerspective.event_ts,
        isAlerted: firstPerspective.is_alerted === 1,
        isInvestigated: firstPerspective.is_investigated === 1,
        debtorName: firstPerspective.debtor_name,
        creditorName: firstPerspective.creditor_name,
        debtorAccountId: firstPerspective.debtor_account_id,
        creditorAccountId: firstPerspective.creditor_account_id,
      };

      // Transform perspectives array (using snake_case to match database schema)
      const entityPerspectives = perspectives.map((p) => ({
        entity_type: p.entity_type,
        entity_role: p.entity_role,
        entity_id: p.entity_id,
        entity_name: p.entity_name ?? 'Unknown Entity',
        transaction_id: p.transaction_id,
        tx_amount: parseFloat(p.tx_amount) || 0,
        tx_ccy: p.tx_ccy,
        event_ts: p.event_ts,
      }));

      return {
        endToEndId,
        tenantId,
        perspectiveCount: perspectives.length,
        transactionDetails,
        perspectives: entityPerspectives,
        meta: {
          queryTimestamp: new Date().toISOString(),
          message: `Retrieved ${perspectives.length} entity perspective(s) for transaction`,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Transaction Perspectives by end_to_end_id: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Transaction Perspectives', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTestAccountIds(tenantId = 'DEFAULT', minConnections = 1): Promise<TestAccountIdsResponse> {
    try {
      this.logger.log(`Fetching test account IDs from lakehouse (minConnections: ${minConnections})`);

      const sql = `
        WITH account_stats AS (
          SELECT 
            debtor_account_id as account_id,
            debtor_name as account_name,
            COUNT(DISTINCT creditor_account_id) as connections,
            COUNT(*) as total_transactions
          FROM transaction_detail
          WHERE tenant_id = '${tenantId}'
            AND debtor_account_id IS NOT NULL
            AND creditor_account_id IS NOT NULL
          GROUP BY debtor_account_id, debtor_name
          HAVING COUNT(DISTINCT creditor_account_id) >= ${minConnections}
          ORDER BY total_transactions DESC
          LIMIT 10
        )
        SELECT 
          account_id,
          account_name,
          connections,
          total_transactions
        FROM account_stats
      `;

      const response = await this.runSqlQuery(sql, 10);
      const accounts = (response?.data ?? []).map((row) => this.stripHudiMetadata(row));

      return {
        message: 'Test account IDs with network activity',
        tenantId,
        accounts: accounts.map((acc) => ({
          accountId: acc.account_id,
          accountName: acc.account_name,
          connections: Number(acc.connections),
          totalTransactions: Number(acc.total_transactions),
          testUrl: `/api/v1/lakehouse/network-analysis/transaction/${acc.account_id}?timeRange=30d`,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching test account IDs: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch test account IDs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionNetworkData(accountId: string, tenantId = 'DEFAULT', timeRange = '30d'): Promise<TransactionNetworkResponseDto> {
    try {
      this.logger.log(`Fetching transaction network for account: ${accountId}, timeRange: ${timeRange}`);

      const centerAccountSql = `
        SELECT DISTINCT 
          COALESCE(debtor_account_id, creditor_account_id) as account_id,
          COALESCE(debtor_name, creditor_name) as account_name
        FROM transaction_detail
        WHERE (debtor_account_id = '${accountId}' OR creditor_account_id = '${accountId}')
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const centerAccountResponse = await this.runSqlQuery(centerAccountSql, 1);
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
        WHERE debtor_account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
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
        WHERE creditor_account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
        GROUP BY debtor_account_id, debtor_name
      `;

      const alertFlagsSql = `
        SELECT DISTINCT '${accountId}' as account_id WHERE 1=0
      `;

      const [outboundResponse, inboundResponse, alertFlagsResponse] = await Promise.all([
        this.runSqlQuery(outboundSql, 1000),
        this.runSqlQuery(inboundSql, 1000),
        this.runSqlQuery(alertFlagsSql, 10),
      ]);

      const outboundData = (outboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const inboundData = (inboundResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));
      const alertFlags = new Set((alertFlagsResponse?.data ?? []).map((row) => this.stripHudiMetadata(row).account_id));

      const allConnections = [...outboundData, ...inboundData];

      const connectedAccounts: ConnectedAccountDto[] = allConnections.map((conn) => {
        const velocity = this.calculateVelocity(Number(conn.total_transactions), Math.max(Number(conn.duration_days), 1));

        const hasAlert = alertFlags.has(conn.connected_account_id);

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
          alertMessage: hasAlert ? 'Alert triggered on this account' : undefined,
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

  async getCounterpartyNetworkData(accountId: string, tenantId = 'DEFAULT', timeRange = '30d'): Promise<CounterpartyNetworkResponseDto> {
    try {
      this.logger.log(`Fetching counterparty network for account: ${accountId}`);

      const accountHolderSql = `
        SELECT 
          debtor_name,
          creditor_name,
          debtor_account_id,
          creditor_account_id
        FROM transaction_detail
        WHERE (debtor_account_id = '${accountId}' OR creditor_account_id = '${accountId}')
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const accountHolderResponse = await this.runSqlQuery(accountHolderSql, 1);
      const accountRow = accountHolderResponse?.data?.[0];

      if (!accountRow) {
        throw new HttpException('Account not found in transactions', HttpStatus.NOT_FOUND);
      }

      const account = this.stripHudiMetadata(accountRow);
      const accountHolder = account.debtor_account_id === accountId ? account.debtor_name : account.creditor_name;

      const counterpartyLinksSql = `
        SELECT DISTINCT counterparty_id
        FROM counterparty_account_links
        WHERE account_id = '${accountId}'
          AND tenant_id = '${tenantId}'
        LIMIT 1
      `;

      const counterpartyLinksResponse = await this.runSqlQuery(counterpartyLinksSql, 1);
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
        WHERE (from_counterparty_id = '${centerCounterpartyId}' 
           OR to_counterparty_id = '${centerCounterpartyId}')
          AND tenant_id = '${tenantId}'
      `;

      const edgesResponse = await this.runSqlQuery(networkEdgesSql, 1000);
      const edges = (edgesResponse?.data ?? []).map((row) => this.stripHudiMetadata(row));

      const allCounterpartyIds = new Set<string>([centerCounterpartyId]);
      edges.forEach((edge) => {
        allCounterpartyIds.add(edge.from_counterparty_id);
        allCounterpartyIds.add(edge.to_counterparty_id);
      });

      const counterpartyNamesMap = new Map<string, string>();

      // Optimize: Get all counterparty names in a single query instead of N+1 queries
      if (allCounterpartyIds.size > 0) {
        const counterpartyIdsList = Array.from(allCounterpartyIds)
          .map((id) => `'${id}'`)
          .join(',');

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
          WHERE cal.counterparty_id IN (${counterpartyIdsList})
            AND cal.tenant_id = '${tenantId}'
            AND td.tenant_id = '${tenantId}'
        `;

        const namesResponse = await this.runSqlQuery(namesSql, 1000);
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

  async getTransactionDetailSampleData(tenantId: string): Promise<unknown> {
    try {
      this.logger.log('Fetching sample transaction_detail table data');
      const sql = `SELECT * FROM transaction_detail WHERE tenant_id = '${tenantId}' LIMIT 100`;
      const response = await this.runSqlQuery(sql, 100);
      return {
        tableName: 'transaction_detail',
        totalRows: response.data?.length ?? 0,
        data: response.data ?? [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching transaction_detail table: ${errorMessage}`);
      throw new HttpException('Failed to fetch transaction_detail table data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateProfile(alertId: number, dto: GenerateProfileDto, userId: string): Promise<GenerateProfileResponseDto> {
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
      SELECT th.transaction_id, th.event_date, th.tx_amount, th.tx_ccy, th.tx_type, th.is_alerted, th.is_investigated, th.cum_tx_count, th.cum_tx_amount, th.entity_role, td.creditor_name, th.entity_id, th.entity_type FROM transaction_detail td_src INNER JOIN transaction_history th ON th.entity_id IN (td_src.creditor_id) AND th.tenant_id = td_src.tenant_id AND th.row_type = 'EVENT' LEFT JOIN transaction_detail td ON td.transaction_id = th.transaction_id AND td.tenant_id = th.tenant_id WHERE td_src.end_to_end_id = '${referenceId}' AND td_src.tx_type = 'pacs.008.001.10' ORDER BY th.event_date DESC;`;

      const transactionCreditorResp = await this.runSqlQuery(transactionCreditorSql, 1000);

      const transactionDebtorSql = `
      SELECT th.transaction_id, th.event_date, th.tx_amount, th.tx_ccy, th.tx_type, th.is_alerted, th.is_investigated, th.cum_tx_count, th.cum_tx_amount, th.entity_role, td.debtor_name, th.entity_id, th.entity_type, td.creditor_name FROM transaction_detail td_src INNER JOIN transaction_history th ON th.entity_id IN (td_src.debtor_id) AND th.tenant_id = td_src.tenant_id AND th.row_type = 'EVENT' LEFT JOIN transaction_detail td ON td.transaction_id = th.transaction_id AND td.tenant_id = th.tenant_id WHERE td_src.end_to_end_id = '${referenceId}' AND td_src.tx_type = 'pacs.008.001.10' ORDER BY th.event_date DESC;`;

      const transactionDebtorResp = await this.runSqlQuery(transactionDebtorSql, 1000);
      return {
        tenantId: dto.tenantId,
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
