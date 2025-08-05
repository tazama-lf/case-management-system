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
import { InvestigateAlertDto } from './dto/investigate-alert-dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CaseType } from '@prisma/client';

@Controller('api/v1/triage')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('submit-alert')
<<<<<<< HEAD
=======
  @UseGuards(AuthGuard('jwt'), RolesGuard)
>>>>>>> 8fcc943 (feat(triage): send alert for manual investigation)
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
<<<<<<< HEAD
    console.log(
      'JWT permissions/roles:',
      req.user.role || req.user.permissions,
    );
    return this.triageService.handleNewAlert(dto, userId, tenantId);
=======

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
>>>>>>> 8fcc943 (feat(triage): send alert for manual investigation)
  }

  @Get('test')
  getTest() {
    return { status: 'ok' };
  }

  @Patch(':alertId')
<<<<<<< HEAD
=======
  @UseGuards(AuthGuard('jwt'))
  @Roles('CMS-TEST-ROLE', 'manage-account')
>>>>>>> 8fcc943 (feat(triage): send alert for manual investigation)
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
<<<<<<< HEAD
=======
  @UseGuards(AuthGuard('jwt'))
  @Roles('CMS-TEST-ROLE', 'manage-account')
>>>>>>> 8fcc943 (feat(triage): send alert for manual investigation)
  async autoCloseAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AutoCloseAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
<<<<<<< HEAD
    return this.triageService.manualCloseAlert(
      alertId,
      dto.status,
      userId,
      tenantId,
    );
=======
    return this.triageService.manualCloseAlert(alertId, dto.status, userId, tenantId);
>>>>>>> df93bad (feat(triage): enforce tenant isolation for alert operations)
  }
<<<<<<< HEAD
=======

  @Patch(':alertId/investigate')
  @UseGuards(AuthGuard('jwt'))
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
      dto.caseType,
      userId,
      tenantId,
    );
  }
>>>>>>> 8fcc943 (feat(triage): send alert for manual investigation)
}
