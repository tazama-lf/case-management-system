<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
=======
import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
>>>>>>> 98eea0c (feat(triage) :  manual alert triage)
=======
import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
>>>>>>> 0842402 (feat:adding auth service)
=======
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
>>>>>>> d0ff41d (feat:adding auth service)
=======
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
>>>>>>> ac7173e (feat: Test Coverage)
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AutoCloseAlertDto } from './dto/auto-close-alert.dto';
<<<<<<< HEAD
<<<<<<< HEAD
import { InvestigateAlertDto } from './dto/investigate-alert-dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
<<<<<<< HEAD
import { CaseType } from '@prisma/client';
=======
>>>>>>> 98eea0c (feat(triage) :  manual alert triage)
=======
import { AuthGuard } from '@nestjs/passport';
>>>>>>> 0842402 (feat:adding auth service)
=======
>>>>>>> 61c1161 (feat: Auth adding roles decorators)

@Controller('api/v1/triage')
<<<<<<< HEAD
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

<<<<<<< HEAD
  @Post('submit-alert')
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;

    const alert = await this.triageService.handleNewAlert(dto, userId, tenantId);

    const confidenceThreshold = process.env.CONFIDENCE_THRESHOLD;

    if (
      confidenceThreshold === undefined ||
      confidenceThreshold === null ||
      confidenceThreshold.trim() === '' ||
      isNaN(Number(confidenceThreshold))
    ) {
      const caseType = CaseType.FRAUD;
      const caseCreated = await this.triageService.investigateAlert(alert.alert_id, caseType, userId, tenantId);
      alert.case_id = caseCreated.case_id;
    }

    return alert;
  }

  @Get('test')
  getTest() {
    return { status: 'ok' };
  }

  @Patch(':alertId')
  @UseGuards(AuthGuard('jwt'))
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async updateAlert(@Param('alertId') alertId: string, @Body() dto: UpdateAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.updateAlertData(alertId, dto, userId, tenantId);
  }

  @Patch(':alertId/auto-close')
  @UseGuards(AuthGuard('jwt'))
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async autoCloseAlert(@Param('alertId') alertId: string, @Body() dto: AutoCloseAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.manualCloseAlert(alertId, dto.status, userId, tenantId);
  }

  @Patch(':alertId/investigate')
  @UseGuards(AuthGuard('jwt'))
  @Roles('CMS-TEST-ROLE', 'manage-account')
  async sendForInvestigation(@Param('alertId') alertId: string, @Body() dto: InvestigateAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.investigateAlert(alertId, dto.caseType, userId, tenantId);
=======
  @Post()
=======
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

<<<<<<< HEAD
  @Post("submit-alert")
>>>>>>> d0ff41d (feat:adding auth service)
  @UseGuards(AuthGuard('jwt'))
=======
  @Post('submit-alert')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
<<<<<<< HEAD
<<<<<<< HEAD
  @Roles('CMS-TEST-ROLE')
>>>>>>> 61c1161 (feat: Auth adding roles decorators)
=======
  @Roles('CMS-TEST-ROLE','manage-account')
>>>>>>> 38c8968 (feat: Unit Test for Auth and Audit)
=======
  @Roles('CMS-TEST-ROLE', 'manage-account')
>>>>>>> ac7173e (feat: Test Coverage)
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
  @UseGuards(AuthGuard('jwt'))
  async updateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
    @Req() req,
  ) {
    const userId = req.user.user_id;
    return this.triageService.updateAlertData(alertId, dto, userId);
  }

  @Patch(':alertId/auto-close')
  @UseGuards(AuthGuard('jwt'))
  async autoCloseAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AutoCloseAlertDto,
    @Req() req,
  ) {
<<<<<<< HEAD
    return this.triageService.manualCloseAlert(alertId, dto.status);
>>>>>>> 98eea0c (feat(triage) :  manual alert triage)
=======
    const userId = req.user.user_id;
    return this.triageService.manualCloseAlert(alertId, dto.status, userId);
>>>>>>> 0842402 (feat:adding auth service)
  }
}
