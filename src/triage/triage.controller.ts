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

@Controller('api/v1/triage')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('submit-alert')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CMS-TEST-ROLE')
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
    const userId = req.user.user_id;
    return this.triageService.manualCloseAlert(alertId, dto.status, userId);
  }
}
