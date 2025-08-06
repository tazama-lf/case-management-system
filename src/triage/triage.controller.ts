import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { InvestigateAlertDto } from './dto/investigate-alert-dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CaseType } from '@prisma/client';
import { InvestigateAlertDto } from './dto/investigate-alert-dto';

@Controller('api/v1/triage/alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;

    // Log JWT permissions/roles for monitoring
    const logValue =
      req.user.role && req.user.role.trim() !== ''
        ? req.user.role
        : req.user.permissions;
    console.log('JWT permissions/roles:', logValue);

    const alert = await this.triageService.handleNewAlert(
      dto,
      userId,
      tenantId,
    );

    const confidenceThreshold = process.env.CONFIDENCE_THRESHOLD;

    if (
      confidenceThreshold === undefined ||
      confidenceThreshold === null ||
      confidenceThreshold.trim() === '' ||
      isNaN(Number(confidenceThreshold))
    ) {
      console.log('CASE_WILL_BE_CREATED');
      const caseType = CaseType.FRAUD;
      const caseCreated = await this.triageService.investigateAlert(
        alert.alert_id,
        caseType,
        userId,
        tenantId,
      );
      alert.case_id = caseCreated.case_id;
    }

    return alert;
  }

  @Get('test')
  getTest() {
    return { status: 'ok' };
  }

  @Patch(':alertId')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async updateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.updateAlertData(alertId, dto, userId, tenantId);
  }

  @Patch(':alertId/close')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async closeAlert(
    @Param('alertId') alertId: string,
    @Body() dto: CloseAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.manualCloseAlert(alertId, dto, userId, tenantId);
  }

  @Patch(':alertId/investigate')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async sendForInvestigation(
    @Param('alertId') alertId: string,
    @Body() dto: InvestigateAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.investigateAlert(
      alertId,
      dto.status,
      userId,
      tenantId,
    );
  }

  @Get()
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async getUserAlerts(
    @Req() req,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
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
      search,
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
}
