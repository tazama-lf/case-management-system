/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ConvertAlertToCase } from './dto/convert-alert-to-case.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/v1/triage/alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('')
  @Roles('CMS-TEST-ROLE', 'manage-account')
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
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async updateAlert(@Param('alertId') alertId: string, @Body() dto: UpdateAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.updateAlertData(alertId, dto, userId, tenantId);
  }

  @Patch(':alertId/close')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async closeAlert(@Param('alertId') alertId: string, @Body() dto: CloseAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.manualCloseAlert(alertId, dto, userId, tenantId);
  }

  @Get()
  @Roles('CMS-TEST-ROLE', 'manage-account')
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
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async getAlertDetails(@Param('alertId') alertId: string, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.getAlertDetails(alertId, tenantId, userId);
  }

  @Post(':alertId/convert-to-case')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async convertAlertToCase(@Param('alertId') alertId: string, @Body() convertAlertToCase: ConvertAlertToCase, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.convertToCase(alertId, convertAlertToCase, userId, tenantId);
  }
}
