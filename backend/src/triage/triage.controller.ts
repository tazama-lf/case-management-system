import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireCMSTestRole } from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import { ManualTriageDto } from './dto/manual-triage.dto';

@Controller('api/v1/triage/alerts')
@UseGuards(TazamaAuthGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('')
  @RequireCMSTestRole()
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    const alert = await this.triageService.handleNewAlert(dto, userId, tenantId, 'REST API');

    return alert;
  }

  @Get('test')
  getTest() {
    return { status: 'ok' };
  }

  // @Post('ingest')
  // async processIncomingAlert(@Body() req: AlertMessageDto) {
  //   const userId = 'c98db341-beb6-457c-98e0-406cc1c71662';
  //   const tenantId = 'c950ac85-96f0-4390-8d94-5b8fdec4e863';

  //   return await this.triageService.processIncomingAlert(req, userId, tenantId);
  // }

  @Patch(':alertId')
  @RequireCMSTestRole()
  async manualTriage(@Param('alertId') alertId: string, @Body() dto: ManualTriageDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    return this.triageService.handleManualTriage(alertId, dto, userId, tenantId);
  }

  @Get()
  @RequireCMSTestRole()
  async getUserAlerts(
    @Req() req: AuthenticatedRequest,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('alertType') alertType?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'created_at',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const tenantId = req.user.token.tenantId;
    return this.triageService.getAlertsForUser({
      tenantId,
      priority,
      type,
      alertType,
      search,
      source,
      page: Number(page),
      limit: Number(limit),
      sortBy,
      sortOrder,
    });
  }

  @Get(':alertId/action-history')
  @RequireCMSTestRole()
  async getAlertActionHistory(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    return this.triageService.getAlertActionHistory(alertId, tenantId, userId);
  }

  @Get(':alertId')
  @RequireCMSTestRole()
  async getAlertDetails(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    return this.triageService.getAlertDetails(alertId, tenantId, userId);
  }
}
