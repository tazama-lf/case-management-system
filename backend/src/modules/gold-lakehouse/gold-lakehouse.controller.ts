import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { RequireInvestigatorOrSupervisorRole } from 'src/decorators/auth.decorator';
import { TransactionNetworkResponseDto, CounterpartyNetworkResponseDto } from './dto/network-analysis.dto';
import { Alerts, Edge, Node } from './types/gold-lakehouse.types';

@ApiTags('Gold Lakehouse')
@Controller('api/v1/lakehouse')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class GoldLakehouseController {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) { }

  @Get('alert-navigator/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorData(
    @Param('alertId') alertId: number,
    @Query('tenantId') tenantId?: string,
  ): Promise<{
    alertMetadata: {
      alertId: number;
      transactionId: string;
      timestamp: string;
      transactionType: string;
      amount: number;
      currency: string;
      status: string;
      reason: string;
      blockReason: string;
    };
    typologies: Array<{
      typologyId: string;
      typologyCfg: string;
      typologyScore: number;
      alertThreshold: number;
      interdictionThreshold: number;
      ruleCount: number;
      rules: string;
    }>;
    statistics: {
      totalTypologies: number;
      totalRules: number;
      avgScore: number;
    };
    meta: {
      alertId: number;
      tenantId: string;
    };
  }> {
    if (isNaN(alertId)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return await this.goldLakehouseService.getAlertNavigatorData(alertId, tenantId ?? 'DEFAULT');
  }

  @Get('transaction-detail/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Transaction Detail data for visualization' })
  @ApiResponse({ status: 200 })
  async getTransactionDetailData(
    @Param('transactionId') transactionId: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<{
    transactionOverview: {
      transactionId: string;
      transactionType: string;
      timestamp: string;
    };
    transactionFlow: {
      debtor: {
        name: string;
        account: {
          iban: string;
          type: string;
        };
        bank: string;
      };
      amount: {
        amount: number;
        currency: string;
      };
      creditor: {
        name: string;
        account: {
          iban: string;
          type: string;
        };
        bankName: string;
      };
    };
    debtorProfile: {
      name: string;
      account: {
        iban: string;
        type: string;
      };
      bank: string;
      swiftCode: string;
      address: string;
      accountType: string;
    };
    creditorProfile: {
      name: string;
      account: {
        iban: string;
        type: string;
      };
      bank: string;
      swiftCode: string;
      address: string;
      accountType: string;
    };
    amountAndCurrency: Array<
      | {
        originalAmount: number;
        exchangeRate: number;
        convertedAmount: number;
      }
      | {
        senderCharges: never[];
        intermediaryCharges: never[];
        receiverCharges: never[];
      }
      | {
        totalCharges: number;
      }
    >;
    settlementDetails: {
      settlementDate: string;
      reference: string;
      purpose: string;
    };
    links: Array<{
      rel: string;
      href: string;
    }>;
  }> {
    const transactionIdNum = parseInt(transactionId, 10);
    if (isNaN(transactionIdNum)) {
      throw new BadRequestException('Invalid transactionId: must be a number');
    }
    return await this.goldLakehouseService.getTransactionDetailData(transactionIdNum, tenantId ?? 'DEFAULT');
  }

  @Get('alert-navigator-metrics/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator Metrics data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorMetrics(
    @Param('alertId') alertId: number,
    @Query('tenantId') tenantId?: string,
  ): Promise<{
    total_typologies: number;
    total_rules: number;
    avg_typology_score: number | null;
    alertId: number;
    tenantId: string;
  }> {
    if (isNaN(alertId)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return await this.goldLakehouseService.getAlertNavigatorMetrics(alertId, tenantId ?? 'DEFAULT');
  }

  // ================ CONDITIONS ENDPOINTS ================
  // Essential endpoints based on available data:
  // 1. Summary - condition counts by account
  // 2. Details - all condition records by account
  // 3. Expired - expired condition details by account
  // 4. Entity accounts - support entity workflows

  @Get('conditions/summary')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get conditions summary with counts by Account ID',
    description: `Returns aggregated condition counts and basic details for a specific account. 
    
    Features:
    - Condition counts by status (active, expired, future)
    - Account metadata (scheme, FSP ID)
    - Historical view support via asOfDate parameter
    - Summary of each condition (type, reason, dates)
    
    Use Cases:
    - Dashboard metrics and KPIs
    - Quick account condition overview
    - Historical compliance checks
    - Account risk assessment
    
    Test with: 87f16412f0d147c1ad2fe94cac078f2c (has rich condition data with real metadata)`,
  })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID from conditions_timeline.cond_account_id field',
    required: true,
    type: String,
    example: '6665bafaee4b430692dafe4bd0efb3fa',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID for multi-tenant filtering (use DEFAULT for cross-tenant)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'asOfDate',
    description:
      'Historical view: Show conditions as they were at this ISO timestamp. Filters based on inception/expiry dates. If omitted, uses current timestamp.',
    required: false,
    type: String,
    example: '2025-12-31T08:00:00',
  })
  @ApiResponse({
    status: 200,
    description: 'Condition summary with counts and basic condition details',
    schema: {
      example: {
        accountId: '87f16412f0d147c1ad2fe94cac078f2c',
        accountScheme: 'MSISDN',
        fspId: 'fsp001',
        totalConditions: 1,
        activeConditions: 0,
        expiredConditions: 1,
        futureConditions: 0,
        conditions: [
          {
            conditionId: 'ba36e82f-d2e1-46fa-a9a4-ed95007db7e0',
            type: 'override',
            perspective: 'creditor',
            reason: 'Suspicion of Money Laundering',
            status: 'expired',
            inceptionDate: '2026-02-04T02:22:33.452000',
            expiryDate: '2026-02-05T02:22:00',
            createdBy: 'demo UI',
          },
        ],
      },
    },
  })
  async getConditionsSummary(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<{
    accountId: string;
    accountScheme: string;
    fspId: string;
    totalConditions: number;
    activeConditions: number;
    expiredConditions: number;
    futureConditions: number;
    conditions: Array<{
      conditionId: string;
      type: string;
      perspective: string;
      reason: string;
      status: string;
      inceptionDate: string;
      expiryDate: string;
      createdBy: string;
    }>;
    metadata: {
      asOfDate: string;
      queryTimestamp: string;
    };
  }> {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    return await this.goldLakehouseService.getConditionsSummaryByAccount(accountId, tenantId ?? 'DEFAULT', undefined, asOfDate);
  }

  @Get('conditions/details')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get complete condition records with full details by Account ID',
    description: `Returns all condition records with complete field data for a specific account. Primary endpoint for detailed condition analysis.
    
    Features:
    - Full condition record details (all database fields)
    - Filter by active status (showInactive parameter)
    - Historical view support (asOfDate parameter)
    - Includes bucket granularity and bucket start dates
    - Force create flags and event type details
    
    Use Cases:
    - Detailed condition investigation
    - Compliance audit trails
    - Historical condition analysis
    - Condition lifecycle tracking
    
    Test with: 87f16412f0d147c1ad2fe94cac078f2c (has full condition data with real creators)`,
  })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID from conditions_timeline.cond_account_id field',
    required: true,
    type: String,
    example: '6665bafaee4b430692dafe4bd0efb3fa',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID for multi-tenant filtering (use DEFAULT for cross-tenant)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'asOfDate',
    description: 'Historical view: Show conditions as they were at this ISO timestamp',
    required: false,
    type: String,
    example: '2025-12-31T08:00:00',
  })
  @ApiQuery({
    name: 'showInactive',
    description: 'Include expired and future conditions. Set to true for complete history. Default: false (active only)',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Complete condition records with all database fields',
    schema: {
      example: {
        accountId: '87f16412f0d147c1ad2fe94cac078f2c',
        totalConditions: 1,
        conditions: [
          {
            conditionId: 'ba36e82f-d2e1-46fa-a9a4-ed95007db7e0',
            pk: 'no mapping found',
            tenantId: 'DEFAULT',
            bucketGranularity: 'no data found',
            bucketStart: 'no data found',
            accountId: '87f16412f0d147c1ad2fe94cac078f2c',
            accountScheme: 'MSISDN',
            type: 'override',
            perspective: 'creditor',
            reason: 'Suspicion of Money Laundering',
            eventTypes: 'all',
            inceptionDate: '2026-02-04T02:22:33.452000',
            expiryDate: '2026-02-05T02:22:00',
            createdDate: '2026-02-04T02:22:33.452000',
            isActive: false,
            isExpired: true,
            createdBy: 'demo UI',
          },
        ],
      },
    },
  })
  async getConditionsDetails(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('showInactive') showInactive?: boolean,
  ) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    return await this.goldLakehouseService.getConditionsListByAccount(accountId, tenantId ?? 'DEFAULT', asOfDate, showInactive);
  }

  // ================ NEW ENDPOINTS FOR CONDITIONS VIEW ================

  @Get('conditions/by-transaction/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get transaction-based conditions context (Transaction Entry Point)',
    description: `Returns complete transaction context with both parties (debtor/creditor), their accounts, and condition statistics. Primary entry point for Conditions Timeline visualization.
    
    Data Flow (UNION Strategy):
    1. Query transaction_detail → Extract debtor/creditor IDs and account IDs
    2. For each party:
       - Add transaction account (direct link)
       - UNION with entity accounts from account_holder
       - Query conditions_timeline for all unique accounts
    3. Return aggregated view with condition counts per account
    
    Features:
    - Transaction metadata (ID, type, amount, timestamp)
    - Both debtor and creditor entity details
    - All accounts linked to each entity (transaction + entity-owned)
    - Condition counts per account (active, expired, future)
    - isTransactionAccount flag to distinguish transaction vs entity accounts
    - Historical view via asOfDate (defaults to transaction timestamp)
    
    Use Cases:
    - Conditions Timeline UI entry point
    - Transaction-based condition investigation
    - Party selection (Debtor vs Creditor)
    - Account-level condition analysis
    
    Test with: 257758 (pacs.008.001.10 transaction with full party data)`,
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction ID (numeric) from transaction_detail table',
    required: true,
    type: Number,
    example: 257758,
  })
  @ApiQuery({
    name: 'asOfDate',
    description: 'Historical view: Show conditions active at this ISO timestamp. Defaults to transaction timestamp if omitted.',
    required: false,
    type: String,
    example: '2025-12-31T08:00:00',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID for multi-tenant filtering',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction context with parties, accounts (via UNION strategy), and condition statistics',
    schema: {
      example: {
        transaction: {
          transactionId: 257758,
          displayId: 'TXN-20260204257758',
          endToEndId: 'TMICFBPK2801321849114534',
          timestamp: '2026-02-04T08:00:00.000Z',
          type: 'pacs.008.001.10',
          amount: 316.13,
          currency: 'USD',
        },
        debtor: {
          entityId: 'f120717550e1476d9ba59d656db346cc',
          entityName: 'Super Ellipse Entity',
          primaryAccountId: '545a8ebfd7ce4ce3bda48246dcff8b15',
          accounts: [
            {
              accountId: '545a8ebfd7ce4ce3bda48246dcff8b15',
              accountNumber: '****dcff8b15',
              accountType: 'no mapping found',
              conditionsCount: {
                total: 1,
                active: 0,
                expired: 1,
                future: 0,
              },
              isTransactionAccount: true,
            },
          ],
        },
        creditor: {
          entityId: '0ebc5e5d5a37466097f967cd01a43318',
          entityName: 'Genuine Litigator Entity',
          primaryAccountId: '87f16412f0d147c1ad2fe94cac078f2c',
          accounts: [
            {
              accountId: '87f16412f0d147c1ad2fe94cac078f2c',
              accountNumber: '****078f2c',
              accountType: 'no mapping found',
              conditionsCount: {
                total: 1,
                active: 0,
                expired: 1,
                future: 0,
              },
              isTransactionAccount: true,
            },
          ],
        },
        metadata: {
          asOfDate: '2026-02-04T08:00:00.000Z',
          queryTimestamp: '2026-03-05T10:30:00Z',
        },
      },
    },
  })
  async getConditionsContextByTransaction(
    @Param('transactionId') transactionId: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const txId = parseInt(transactionId, 10);
    if (isNaN(txId)) {
      throw new BadRequestException('Invalid transactionId: must be a number');
    }
    return await this.goldLakehouseService.getConditionsContextByTransaction(txId, tenantId ?? 'DEFAULT', asOfDate);
  }

  @Get('conditions/by-entity/:entityId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get all conditions across entity-owned accounts (Entity-Level View)',
    description: `Returns aggregated conditions for all accounts owned by a specific legal entity. Used for entity-level compliance and risk assessment.
    
    Data Flow:
    1. Query account_holder WHERE source = entityId → Get associated accounts
    2. Query conditions WHERE entity_id = entityId → Get entity-level conditions  
    3. Query conditions WHERE account_id IN (accounts) → Get account-level conditions
    4. Return aggregated view with both entity and account conditions
    
    Features:
    - Both entity-level AND account-level conditions
    - Real metadata: created_by_user, account_scheme, fsp_id
    - All accounts owned by the entity
    - Simplified queries (no complex bucketing)
    - Filter by active status (showInactive)
    - Historical view support (asOfDate)
    
    Use Cases:
    - Entity-level condition oversight
    - Legal entity risk profiling
    - Multi-account condition tracking
    - Entity compliance monitoring
    
    Note: Entity must exist in account_holder.source field
    
    Test with: 0ebc5e5d5a37466097f967cd01a43318 (real entity with conditions)`,
  })
  @ApiParam({
    name: 'entityId',
    description: 'Entity ID from conditions.entity_id field or account_holder.source - supports both account and entity conditions',
    required: true,
    type: String,
    example: '0ebc5e5d5a37466097f967cd01a43318',
  })
  @ApiQuery({
    name: 'asOfDate',
    description: 'Historical view: Show conditions active at this ISO timestamp',
    required: false,
    type: String,
    example: '2025-12-31T08:00:00',
  })
  @ApiQuery({
    name: 'showInactive',
    description: 'Include expired and future conditions. Default: false (active only)',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID for multi-tenant filtering',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity-level condition view with all accounts and aggregated statistics',
    schema: {
      example: {
        entityId: '0ebc5e5d5a37466097f967cd01a43318',
        accounts: ['87f16412f0d147c1ad2fe94cac078f2c'],
        conditions: [
          {
            conditionId: 'f0b633d3-8232-4f86-bf79-81f490651f9f',
            title: 'Suspicion of Money Laundering',
            type: 'overridable-block',
            createdBy: 'TAZAMA_DEMO_UI',
            startDate: '2026-02-03T03:05:54.636000',
            endDate: '2026-02-04T03:05:00',
            status: 'EXPIRED',
            accountId: '0ebc5e5d5a37466097f967cd01a43318',
            notes: 'Suspicion of Money Laundering',
          },
        ],
        metadata: {
          entityId: '0ebc5e5d5a37466097f967cd01a43318',
          queryTimestamp: '2026-03-05T10:30:00Z',
        },
      },
    },
  })
  async getConditionsByEntity(
    @Param('entityId') entityId: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('showInactive') showInactive?: boolean,
    @Query('tenantId') tenantId?: string,
  ) {
    return await this.goldLakehouseService.getConditionsByEntity(entityId, tenantId ?? 'DEFAULT', asOfDate, showInactive);
  }

  @Get('transaction-history/:endToEndId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Transaction History data by End-to-End ID or Entity ID',
    description:
      'Returns transaction data based on the provided ID. Accepts either end_to_end_id (UUID format) for single transaction with all entity perspectives, or entity_id (account/counterparty) for historical timeline showing multiple transactions over time. Auto-detects ID type. Optional filters: startDate, endDate, granularity.',
  })
  @ApiParam({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID (UUID) or Entity ID (account/counterparty identifier) - REQUIRED. Auto-detects type.',
    required: true,
    type: String,
    example: 'ee4f3638-c42d-4a7e-abec-4c3aff068570',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Filter start date - OPTIONAL (YYYY-MM-DD). ',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Filter end date - OPTIONAL (YYYY-MM-DD).',
    required: false,
    type: String,
    example: '2026-01-31',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Aggregation bucket granularity - OPTIONAL (day, week, month, year). ',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    type: String,
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transaction history data including timeline with cumulative amounts, volume distribution, recent transactions table, and summary statistics',
    schema: {
      example: {
        summary: {
          totalVolume: 102518.5,
          totalTransactions: 154,
          alertsTriggered: 6,
          alertsPercentage: 3.9,
          investigated: 0,
          investigatedPercentage: 0,
          avgTransactionsPerDay: 5.13,
          durationDays: 30,
        },
        timeline: [
          {
            transactionId: 15,
            date: '2026-01-15',
            amount: 1250.0,
            currency: 'USD',
            type: 'pacs.008.001.10',
            isAlerted: true,
            isInvestigated: false,
          },
        ],
        cumulative: [
          {
            date: '2026-01-01',
            cumulativeAmount: 50000.0,
            cumulativeCount: 40,
          },
        ],
        volumeDistribution: [
          {
            bucketStart: '2026-01-01',
            granularity: 'day',
            transactionCount: 5,
            totalVolume: 5000.0,
          },
        ],
        recentTransactions: [
          {
            transactionId: 15,
            date: '2026-01-15',
            type: 'pacs.008.001.10',
            counterparty: 'Jane Smith',
            amount: 1250.0,
            currency: 'USD',
            status: ['Alert'],
            actions: {
              viewDetailsLink: '/triage/transaction-detail/15',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid ID or date format' })
  async getTransactionHistoryData(
    @Param('endToEndId') endToEndId: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: string,
  ): Promise<any> {
    // Validate ID
    if (!endToEndId || endToEndId.trim() === '') {
      throw new BadRequestException('Transaction ID or Entity ID is required');
    }

    // Validate date format if provided
    if (startDate ?? endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/v;
      if ((startDate && !dateRegex.test(startDate)) ?? (endDate && !dateRegex.test(endDate))) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }

      // Both dates must be provided together
      if ((startDate && !endDate) ?? (!startDate && endDate)) {
        throw new BadRequestException('Both startDate and endDate must be provided together');
      }
    }

    // Validate granularity if provided
    if (granularity) {
      const validGranularities = ['day', 'week', 'month', 'year'];
      if (!validGranularities.includes(granularity)) {
        throw new BadRequestException(`Invalid granularity. Must be one of: ${validGranularities.join(', ')}`);
      }
    }

    return await this.goldLakehouseService.getTransactionHistoryData(endToEndId, tenantId ?? 'DEFAULT', startDate, endDate, granularity);
  }

  @Get('transaction-perspectives/:endToEndId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Transaction Perspectives by End-to-End ID',
    description:
      'Returns all entity perspectives (Debtor Account, Creditor Account, Debtor Counterparty, Creditor Counterparty) for a single transaction. Shows how the transaction appears from each entity viewpoint. Query by end_to_end_id (transaction UUID) to get complete transaction context.',
  })
  @ApiParam({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID (UUID) - REQUIRED',
    required: true,
    type: String,
    example: 'ee4f3638-c42d-4a7e-abec-4c3aff068570',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction perspectives data showing all entity views of the transaction',
    schema: {
      example: {
        endToEndId: 'ee4f3638-c42d-4a7e-abec-4c3aff068570',
        tenantId: 'DEFAULT',
        perspectiveCount: 4,
        transactionDetails: {
          transactionId: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
          endToEndId: 'ee4f3638-c42d-4a7e-abec-4c3aff068570',
          amount: 1500.0,
          currency: 'USD',
          type: 'pacs.008.001.10',
          date: '2026-01-20',
          timestamp: '2026-01-20T10:30:00Z',
          isAlerted: true,
          isInvestigated: false,
          debtorName: 'John Smith',
          creditorName: 'Jane Doe',
          debtorAccountId: 'dbtrAcct_abc123',
          creditorAccountId: 'cdtrAcct_def456',
        },
        perspectives: [
          {
            entityType: 'ACCOUNT',
            entityRole: 'DEBTOR',
            entityId: 'dbtrAcct_abc123',
            entityName: 'John Smith Account',
            transactionId: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
            amount: 1500.0,
            currency: 'USD',
            timestamp: '2026-01-20T10:30:00Z',
          },
          {
            entityType: 'ACCOUNT',
            entityRole: 'CREDITOR',
            entityId: 'cdtrAcct_def456',
            entityName: 'Jane Doe Account',
            transactionId: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
            amount: 1500.0,
            currency: 'USD',
            timestamp: '2026-01-20T10:30:00Z',
          },
          {
            entityType: 'COUNTERPARTY',
            entityRole: 'DEBTOR',
            entityId: 'dbtr_xyz789',
            entityName: 'John Smith',
            transactionId: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
            amount: 1500.0,
            currency: 'USD',
            timestamp: '2026-01-20T10:30:00Z',
          },
          {
            entityType: 'COUNTERPARTY',
            entityRole: 'CREDITOR',
            entityId: 'cdtr_uvw321',
            entityName: 'Jane Doe',
            transactionId: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
            amount: 1500.0,
            currency: 'USD',
            timestamp: '2026-01-20T10:30:00Z',
          },
        ],
        meta: {
          queryTimestamp: '2026-02-10T12:00:00.000Z',
          message: 'Retrieved 4 entity perspective(s) for transaction',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid end-to-end ID format' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionPerspectives(@Param('endToEndId') endToEndId: string, @Query('tenantId') tenantId?: string): Promise<unknown> {
    // Validate end-to-end ID
    if (!endToEndId || endToEndId.trim() === '') {
      throw new BadRequestException('End-to-End ID is required');
    }

    // Basic UUID format validation (optional but recommended)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iv;
    if (!uuidRegex.test(endToEndId)) {
      throw new BadRequestException('Invalid end-to-end ID format. Must be a valid UUID.');
    }

    return await this.goldLakehouseService.getTransactionPerspectivesByEndToEndId(endToEndId, tenantId ?? 'DEFAULT');
  }

  @Get('alert-history/summary')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Summary',
    description:
      'Returns summary metrics for alert history including total alerts, user-opened, investigations, cases raised, and total transaction value. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert history summary metrics',
    schema: {
      example: {
        totalAlerts: 179,
        casesOpened: 48,
        investigations: 90,
        sarFilings: 4,
        totalValue: 2957437.0,
      },
    },
  })
  async getAlertHistorySummary(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.goldLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange ?? 'all');
  }

  @Get('alert-history/timeline')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Timeline',
    description:
      'Returns time-series data for alert history including alert counts, case counts, investigation counts, and total values grouped by date granularity. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Aggregation bucket granularity - OPTIONAL (day, week, month, year)',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    type: String,
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert history timeline data with separate alert count and alert value arrays',
    schema: {
      example: {
        alertCountOverTime: [
          {
            date: '2026-01-20T00:00:00.000Z',
            alerts: 25,
            cases: 5,
            investigations: 10,
          },
          {
            date: '2026-01-19T00:00:00.000Z',
            alerts: 30,
            cases: 8,
            investigations: 15,
          },
        ],
        alertValueOverTime: [
          {
            date: '2026-01-20T00:00:00.000Z',
            totalValue: 125000.5,
          },
          {
            date: '2026-01-19T00:00:00.000Z',
            totalValue: 89500.75,
          },
        ],
      },
    },
  })
  async getAlertHistoryTimeline(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('granularity') granularity = 'day',
  ) {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    if (granularity) {
      const validGranularities = ['day', 'week', 'month', 'year'];
      if (!validGranularities.includes(granularity)) {
        throw new BadRequestException(`Invalid granularity. Must be one of: ${validGranularities.join(', ')}`);
      }
    }
    return await this.goldLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  @Get('alert-history/alerts')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Alerts',
    description:
      'Returns paginated list of alerts with customer names, account IDs, transaction details, and navigation actions. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number - OPTIONAL (default: 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page - OPTIONAL (default: 20)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated alert history list',
    schema: {
      example: {
        alerts: [
          {
            alertId: 444,
            date: '2026-01-20T03:26:47.789892',
            type: 'FRAUD_AND_AML',
            severity: 'BREACH',
            status: 'ALRT',
            caseId: 225,
            outcome: 'Investigating',
            actions: {
              viewAlertNavigator: '/alert-navigator/444',
              viewTransactionDetails: '/transaction-detail/598777d8-ad56-4af4-8f4d-417a870834f2',
            },
          },
        ],
        pagination: {
          total: 21,
          page: 1,
          limit: 20,
          totalPages: 2,
        },
      },
    },
  })
  async getAlertHistoryAlerts(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    alerts: Alerts[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.goldLakehouseService.getAlertHistoryAlerts(
      endToEndId,
      tenantId,
      dateRange ?? 'all',
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  // ---------------- TRANSACTION VIEW ----------------

  @Get('network-analysis/test-accounts')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Test Account IDs',
    description: 'Fetches account IDs with network activity for testing network analysis endpoints',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID',
    required: false,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'minConnections',
    description: 'Minimum number of unique connections required (default: 1)',
    required: false,
    example: 2,
  })
  @ApiResponse({ status: 200, description: 'List of test account IDs with network statistics' })
  async getTestAccountIds(@Query('tenantId') tenantId?: string, @Query('minConnections') minConnections?: number): Promise<unknown> {
    return await this.goldLakehouseService.getTestAccountIds(tenantId ?? 'DEFAULT', minConnections ?? 1);
  }

  // ---------------- TRANSACTION NETWORK ANALYSIS ----------------
  @Get('network-analysis/transaction/:accountId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Transaction Network Analysis',
    description:
      'Fetches network visualization data showing all accounts connected to the specified account through transactions, including transaction statistics, flow directions, and alert flags.',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Center account ID for network analysis',
    example: 'ACC-1234',
  })
  @ApiQuery({
    name: 'timeRange',
    description: 'Time range for transaction history',
    required: false,
    enum: ['7d', '30d', '90d', '1y', 'all'],
    example: '30d',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID',
    required: false,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description: 'Network analysis data with center account, connected accounts, edges, and statistics',
    type: TransactionNetworkResponseDto,
  })
  async getTransactionNetworkAnalysis(
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<TransactionNetworkResponseDto> {
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return await this.goldLakehouseService.getTransactionNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  @Get('network-analysis/account/:accountId')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Account Network graph + selected account details',
    description:
      'Returns account network visualization (nodes + edges) along with full details for the selected account node (metrics, alerts, investigation status).',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Root Account ID for network visualization',
    required: true,
    example: 'dbtrAcct_e8b116f1ebd14de7b653d7d3c520ffdd',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID (defaults to DEFAULT)',
    required: false,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Network aggregation granularity',
    required: false,
    enum: ['day', 'month', 'year'],
    example: 'month',
  })
  @ApiResponse({
    status: 200,
    description: 'Account network graph and selected account detail panel data',
  })
  async getAccountNetworkWithDetails(
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('granularity') granularity?: string,
  ): Promise<{
    network: {
      rootNodeId: string;
      nodes: Node[];
      edges: Edge[];
    };
    accountDetails: {
      accountId: string;
      accountHolder: string;
      relationship: string;
      transactions: number;
      totalValue: number;
      velocity: string;
      flags: {
        alerted: boolean;
        investigated: boolean;
      };
    };
    meta: {
      tenantId: string;
      granularity: 'day' | 'month' | 'year';
      generatedAt: string;
    };
  }> {
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }

    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }

    return await this.goldLakehouseService.getAccountNodeFullData(
      accountId,
      tenantId ?? 'DEFAULT',
      (granularity as 'day' | 'month' | 'year' | undefined) ?? 'month',
    );
  }

  @Get('network-analysis/counterparty-node/:counterpartyId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Counterparty Network graph + selected counterparty details',
    description: 'Returns counterparty network visualization (nodes + edges) along with full details for the selected counterparty node.',
  })
  @ApiParam({
    name: 'counterpartyId',
    description: 'Root Counterparty ID for network visualization',
    required: true,
    example: 'dbtr_abc123',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID (defaults to DEFAULT)',
    required: false,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Network aggregation granularity',
    required: false,
    enum: ['day', 'month', 'year'],
    example: 'month',
  })
  @ApiResponse({
    status: 200,
    description: 'Counterparty network graph and selected counterparty detail panel data',
  })
  async getCounterpartyNetworkWithDetails(
    @Param('counterpartyId') counterpartyId: string,
    @Query('tenantId') tenantId?: string,
    @Query('granularity') granularity?: string,
  ): Promise<{
    network: {
      rootNodeId: string;
      nodes: Node[];
      edges: Edge[];
    };
    counterpartyDetails: {
      counterpartyId: string;
      name: string;
      type: string;
      transactions: number;
      totalValue: number;
      velocity: string;
      flags: {
        alerted: boolean;
        investigated: boolean;
      };
    };
    meta: {
      tenantId: string;
      granularity: 'day' | 'month' | 'year';
      generatedAt: string;
    };
  }> {
    if (!counterpartyId || counterpartyId.trim() === '') {
      throw new BadRequestException('counterpartyId is required');
    }

    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }

    return await this.goldLakehouseService.getCounterpartyNodeFullData(
      counterpartyId,
      tenantId ?? 'DEFAULT',
      (granularity as 'day' | 'month' | 'year' | undefined) ?? 'month',
    );
  }

  @Get('lake/analytics/benford/account/:accountId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Apply Benford’s Law on account transactions',
    description:
      'Applies Benford’s Law to successful transaction amounts where the given account appears as debtor or creditor, over a selected date range.',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Account ID (used as debtor or creditor)',
    required: true,
    example: 'dbtrAcct_e8b116f1ebd14de7b653d7d3c520ffdd',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID',
    required: true,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'from',
    description: 'Start date (YYYY-MM-DD)',
    required: true,
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'to',
    description: 'End date (YYYY-MM-DD)',
    required: true,
    example: '2026-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Benford analysis (expected vs actual distribution)',
  })
  async benfordByAccount(
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
  ): Promise<{
    expected: Record<number, number>;
    actual: Record<number, number>;
    sampleSize: number;
    meta: {
      accountId: string;
      tenantId: string;
      fromDate: string;
      toDate: string;
    };
  }> {
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }

    if (!tenantId || tenantId.trim() === '') {
      throw new BadRequestException('tenantId is required');
    }

    if (!fromDate || !toDate) {
      throw new BadRequestException('from and to dates are required');
    }

    // Optional but recommended
    if (new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException('from date cannot be after to date');
    }

    return await this.goldLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, fromDate, toDate);
  }

  // ---------------- COUNTERPARTY VIEW ----------------

  @Get('network-analysis/counterparty/:accountId')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Counterparty Network Analysis',
    description:
      'Fetches entity-level network visualization showing relationships between people and organizations connected to the specified account. Analyzes counterparty connections, transaction patterns, alert flags, and investigation status to identify potential fraud networks.',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Account ID to analyze counterparty network from',
    example: 'cdtrAcct_9e6fccad1b1b4850a6e90f548207748b',
  })
  @ApiQuery({
    name: 'timeRange',
    description: 'Time range for network analysis (applied to filtering, data is pre-aggregated)',
    required: false,
    enum: ['7d', '30d', '90d', '1y', 'all'],
    example: '30d',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID',
    required: false,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description:
      'Counterparty network data with account details, center entity, connected counterparties, relationship edges, and comprehensive statistics including alert and investigation flags',
    type: CounterpartyNetworkResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found or no counterparties associated with account',
  })
  async getCounterpartyNetworkAnalysis(
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<CounterpartyNetworkResponseDto> {
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return await this.goldLakehouseService.getCounterpartyNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  // ---------------- DEBUG ENDPOINTS FOR DATA ANALYSIS ----------------

  @Get('debug/conditions-table')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'DEBUG: Get all conditions table data' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, example: 'DEFAULT' })
  async getAllConditions(@Query('tenantId') tenantId?: string) {
    return await this.goldLakehouseService.getAllConditionsTableData(tenantId ?? 'DEFAULT');
  }

  @Get('debug/conditions-timeline-table')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'DEBUG: Get all conditions_timeline table data' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, example: 'DEFAULT' })
  async getAllConditionsTimeline(@Query('tenantId') tenantId?: string) {
    return await this.goldLakehouseService.getAllConditionsTimelineData(tenantId ?? 'DEFAULT');
  }

  @Get('debug/account-holder-table')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'DEBUG: Get all account_holder table data (limited to 200 rows)' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, example: 'DEFAULT' })
  async getAllAccountHolder(@Query('tenantId') tenantId?: string) {
    return await this.goldLakehouseService.getAllAccountHolderData(tenantId ?? 'DEFAULT');
  }

  @Get('debug/transaction-detail-table')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'DEBUG: Get sample transaction_detail table data (limited to 100 rows)' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, example: 'DEFAULT' })
  async getTransactionDetailSample(@Query('tenantId') tenantId?: string) {
    return await this.goldLakehouseService.getTransactionDetailSampleData(tenantId ?? 'DEFAULT');
  }
}
