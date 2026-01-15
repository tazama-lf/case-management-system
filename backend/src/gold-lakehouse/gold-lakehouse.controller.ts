import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
  async getAlertNavigatorData(
    @Param('alertId') alertId: number,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.goldLakehouseService.getAlertNavigatorData(alertId, tenantId);
  }

  @Get('transaction-detail/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Transaction Detail data for visualization' })
  @ApiResponse({ status: 200 })
  async getTransactionDetailData(
    @Param('transactionId') transactionId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.goldLakehouseService.getTransactionDetailData(transactionId, tenantId);
  }
}
