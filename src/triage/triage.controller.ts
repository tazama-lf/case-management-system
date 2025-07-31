import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AutoCloseAlertDto } from './dto/auto-close-alert.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/triage/alerts')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req) {
    const userId = req.user.user_id;
    const tenantId = req.user.tenantId;
    return this.triageService.handleNewAlert(dto, userId, tenantId);
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