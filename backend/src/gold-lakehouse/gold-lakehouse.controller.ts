import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { RequireInvestigatorOrSupervisorRole } from 'src/auth/auth.decorator';

@ApiTags('Gold Lakehouse')
@Controller('api/v1/lakehouse')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class GoldLakehouseController {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) {}

  @Get('alert-navigator/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorData(@Param('alertId') alertId: string, @Query('tenantId') tenantId?: string) {
    const alertIdNum = parseInt(alertId, 10);
    if (isNaN(alertIdNum)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return this.goldLakehouseService.getAlertNavigatorData(alertIdNum, tenantId || 'DEFAULT');
  }

  @Get('transaction-detail/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Transaction Detail data for visualization' })
  @ApiResponse({ status: 200 })
  async getTransactionDetailData(@Param('transactionId') transactionId: string, @Query('tenantId') tenantId?: string) {
    const transactionIdNum = parseInt(transactionId, 10);
    if (isNaN(transactionIdNum)) {
      throw new BadRequestException('Invalid transactionId: must be a number');
    }
    return this.goldLakehouseService.getTransactionDetailData(transactionIdNum, tenantId || 'DEFAULT');
  }

  @Get('alert-navigator-metrics/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator Metrics data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorMetrics(@Param('alertId') alertId: string, @Query('tenantId') tenantId?: string) {
    const alertIdNum = parseInt(alertId, 10);
    if (isNaN(alertIdNum)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return this.goldLakehouseService.getAlertNavigatorMetrics(alertIdNum, tenantId || 'DEFAULT');
  }

  // ---------------- CONDITIONS VIEW ----------------

  @Get('conditions/summary')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Conditions summary metrics' })
  @ApiResponse({ status: 200 })
  async getConditionsSummary(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('fromDate') fromDate: string,
  ) {
    if (!accountId || !tenantId || !fromDate) {
      throw new BadRequestException('accountId, tenantId and fromDate are required');
    }

    return this.goldLakehouseService.getConditionsSummary(accountId, tenantId, fromDate);
  }

  @Get('conditions')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Conditions list (active / expired / future)' })
  @ApiResponse({ status: 200 })
  async getConditionsList(@Query('accountId') accountId: string, @Query('tenantId') tenantId: string) {
    if (!accountId || !tenantId) {
      throw new BadRequestException('accountId and tenantId are required');
    }

    return this.goldLakehouseService.getConditionsList(accountId, tenantId);
  }

  @Get('conditions/evaluated-transactions')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get evaluated transactions for Conditions view',
  })
  @ApiResponse({ status: 200 })
  async getEvaluatedTransactions(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('fromDate') fromDate: string,
  ) {
    if (!accountId || !tenantId || !fromDate) {
      throw new BadRequestException('accountId, tenantId and fromDate are required');
    }

    return this.goldLakehouseService.getEvaluatedTransactions(accountId, tenantId, fromDate);
  }
}
