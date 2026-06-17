import { Controller, Get, Param, Query, UseGuards, BadRequestException, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { AlertsLakehouseService } from './alerts-lakehouse.service';
import { TransactionLakehouseService } from './transaction-lakehouse.service';
import { ConditionLakehouseService } from './condition-lakehouse.service';
import { BenfordsLawLakehouseService } from './benfordsLaw-lakehouse.service';
import { AccountLakehouseService } from './account-lakehouse.service';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { TransactionNetworkResponseDto, CounterpartyNetworkResponseDto } from './dto/network-analysis.dto';
import { AccountNodeFullDataResponse, CounterpartyNodeFullDataResponse } from './types/gold-lakehouse-responses.types';
import { AlertNavigatorDataResponse } from './types/alert-navigator.types';
import { TransactionDetailDataResponse } from './types/transaction-detail.types';
import { AccountConditionsSummary, ConditionsListByAccountResponse } from './types/IAccountConditions.types';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { GenerateProfileResponseDto } from './dto/profile-response.dto';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { EntityMetadataResponse } from './interfaces/entity-metadata.interfaces';

@ApiTags('Gold Lakehouse')
@Controller('api/v1/lakehouse')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class GoldLakehouseController {
  constructor(
    private readonly alertsLakehouseService: AlertsLakehouseService,
    private readonly transactionLakehouseService: TransactionLakehouseService,
    private readonly conditionLakehouseService: ConditionLakehouseService,
    private readonly benfordsLawLakehouseService: BenfordsLawLakehouseService,
    private readonly accountLakehouseService: AccountLakehouseService,
  ) { }

  /**
   * Extract JWT token from request headers
   */
  private extractJwt(req: AuthenticatedRequest): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  }

  @Get('entity-metadata/:alertId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get Entity Metadata for a given Alert ID' })
  async getEntityMetadataByAlertId(
    @Param('alertId') alertId: number,
    @Query('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EntityMetadataResponse> {
    if (isNaN(alertId)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    const userJwt = this.extractJwt(req);
    const entityMetadata = await this.accountLakehouseService.getEntityMetadataByAlertId(alertId, tenantId, userJwt);
    return entityMetadata;
  }

  @Get('alert-navigator/:alertId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get Alert Navigator data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorData(
    @Param('alertId') alertId: number,
    @Query('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AlertNavigatorDataResponse> {
    if (isNaN(alertId)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    const userJwt = this.extractJwt(req);
    return await this.alertsLakehouseService.getAlertNavigatorData(alertId, tenantId, userJwt);
  }

  @Get('transaction-detail/:endToEndId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get Transaction Detail data for visualization' })
  @ApiResponse({ status: 200 })
  async getTransactionDetailData(
    @Param('endToEndId') endToEndId: string,
    @Query('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<TransactionDetailDataResponse> {
    const userJwt = this.extractJwt(req);
    return await this.transactionLakehouseService.getTransactionDetailData(endToEndId, tenantId, userJwt);
  }

  // ================ CONDITIONS ENDPOINTS ================

  @Get('conditions/summary')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    @Query('tenantId') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<AccountConditionsSummary> {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.conditionLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate, userJwt);
  }

  @Get('conditions/details')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    required: true,
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
    @Query('tenantId') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('showInactive') showInactive?: boolean,
    @Req() req?: AuthenticatedRequest,
  ): Promise<ConditionsListByAccountResponse> {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.conditionLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive, userJwt);
  }

  // ---------------- TRANSACTION NETWORK ANALYSIS ----------------
  @Get('network-analysis/transaction/:accountId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    required: true,
    example: 'DEFAULT',
  })
  @ApiResponse({
    status: 200,
    description: 'Network analysis data with center account, connected accounts, edges, and statistics',
    type: TransactionNetworkResponseDto,
  })
  async getTransactionNetworkAnalysis(
    @Query('tenantId') tenantId: string,
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<TransactionNetworkResponseDto> {
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.transactionLakehouseService.getTransactionNetworkData(accountId, tenantId, timeRange ?? '30d', userJwt);
  }

  @Get('network-analysis/entity-network/:entityId')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get Entity Network graph + entity details',
    description: 'Returns entity network visualization (nodes + edges) for all accounts associated with an entity ID.',
  })
  @ApiParam({
    name: 'entityId',
    description: 'Entity ID to fetch network data for',
    required: true,
    example: 'entity123',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID (defaults to DEFAULT)',
    required: true,
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
    description: 'Entity network graph and associated accounts data',
  })
  async getEntityNetworkWithDetails(
    @Param('entityId') entityId: string,
    @Query('tenantId') tenantId: string,
    @Query('granularity') granularity?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<AccountNodeFullDataResponse> {
    if (!entityId || entityId.trim() === '') {
      throw new BadRequestException('entityId is required');
    }

    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }

    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.accountLakehouseService.getAccountNodeFullData(
      entityId,
      tenantId,
      (granularity as 'day' | 'month' | 'year' | undefined) ?? 'month',
      userJwt,
    );
  }

  @Get('network-analysis/counterparty-node/:counterpartyId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    required: true,
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
    @Query('tenantId') tenantId: string,
    @Query('granularity') granularity?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<CounterpartyNodeFullDataResponse> {
    if (!counterpartyId || counterpartyId.trim() === '') {
      throw new BadRequestException('counterpartyId is required');
    }

    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }

    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.accountLakehouseService.getCounterpartyNodeFullData(
      counterpartyId,
      tenantId,
      (granularity as 'day' | 'month' | 'year' | undefined) ?? 'month',
      userJwt,
    );
  }

  @Get('lake/analytics/benford/account/:accountId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    @Req() req?: AuthenticatedRequest,
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

    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.benfordsLawLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, fromDate, toDate, userJwt);
  }

  // ---------------- COUNTERPARTY VIEW ----------------

  @Get('network-analysis/counterparty/:accountId')
  // Access restricted: require investigator or supervisor role
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    required: true,
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
    @Query('tenantId') tenantId: string,
    @Query('timeRange') timeRange?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<CounterpartyNetworkResponseDto> {
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    const userJwt = req ? this.extractJwt(req) : undefined;
    return await this.transactionLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange ?? '30d', userJwt);
  }

  @Post('profile/generate/:alertId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({ summary: 'Generate transaction profile for a case (DWH data)' })
  @ApiBody({
    type: GenerateProfileDto,
    examples: {
      default: {
        summary: 'Typical profile generation',
        value: {
          tenantId: 'DEFAULT',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Profile generated', type: GenerateProfileResponseDto })
  async generateProfile(
    @Param('alertId') alertId: number,
    @Body() dto: GenerateProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<GenerateProfileResponseDto> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user;
    const userJwt = this.extractJwt(req);
    return await this.transactionLakehouseService.generateProfile(alertId, dto, userId, tenantId, userJwt);
  }
}
