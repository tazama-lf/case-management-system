import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { TriageService } from './triage.service';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ConvertAlertToCase } from './dto/convert-alert-to-case.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireCMSTestRole } from 'src/auth/auth.decorator';

@Controller('api/v1/triage/alerts')
@UseGuards(TazamaAuthGuard)
export class TriageController {
  constructor(
    private readonly logger: LoggerService,
    private readonly triageService: TriageService,
  ) {}

  @Post('')
  // @Roles('CMS-TEST-ROLE', 'manage-account')
  @RequireCMSTestRole()
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;

    const alert = await this.triageService.handleNewAlert(dto, userId, tenantId, 'REST API');

    return alert;
  }

  @Get('test')
  getTest() {
    return { status: 'ok' };
  }

  @Patch(':alertId')
  @RequireCMSTestRole()
  async updateAlert(@Param('alertId') alertId: string, @Body() dto: UpdateAlertDto, @Req() req) {
    const userId = req.user.token.user_id;
    const tenantId = req.user.token.tenantId;
    return this.triageService.updateAlertData(alertId, dto, userId, tenantId);
  }

  @Patch(':alertId/close')
  @RequireCMSTestRole()
  async closeAlert(@Param('alertId') alertId: string, @Body() dto: CloseAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.manualCloseAlert(alertId, dto, userId, tenantId);
  }

  @Get()
  @RequireCMSTestRole()
  async getUserAlerts(
    @Req() req,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('alertType') alertType?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'created_at',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const tenantId = req.user.tenantId;
    return this.triageService.getAlertsForUser({
      tenantId,
      priority,
      status,
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

  @Get(':alertId')
  @RequireCMSTestRole()
  async getAlertDetails(@Param('alertId') alertId: string, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.getAlertDetails(alertId, tenantId, userId);
  }

  @Post(':alertId/convert-to-case')
  @RequireCMSTestRole()
  async convertAlertToCase(@Param('alertId') alertId: string, @Body() convertAlertToCase: ConvertAlertToCase, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.convertToCase(alertId, convertAlertToCase, userId, tenantId);
  }
}
