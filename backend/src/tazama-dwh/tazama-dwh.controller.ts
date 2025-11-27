import { Controller, Post, Get, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TazamaDwhService } from './tazama-dwh.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';

@ApiTags('Tazama DWH')
@Controller('api/v1/dwh')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class TazamaDWHController {
  constructor(private readonly tazamaDwhService: TazamaDwhService) {}

  @Get('transactions/:creditorId')
  @RequireInvestigatorOrSupervisorRole()
  async getTransactionsByCreditor(
    @Req() req: AuthenticatedRequest,
    @Param('creditorId') creditorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.token.tenantId;
    return this.tazamaDwhService.getTransactionsByCreditorId(tenantId, creditorId, startDate, endDate);
  }
}
