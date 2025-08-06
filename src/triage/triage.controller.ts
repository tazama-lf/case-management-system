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
import { AutoCloseAlertDto } from './dto/auto-close-alert.dto';
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
    console.log(
      'JWT permissions/roles:',
      req.user.role || req.user.permissions,
    );
    return this.triageService.handleNewAlert(dto, userId, tenantId);
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

  @Patch(':alertId/auto-close')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async autoCloseAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AutoCloseAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.manualCloseAlert(alertId, dto.status, userId, tenantId);
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
}
