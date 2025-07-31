import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AutoCloseAlertDto } from './dto/auto-close-alert.dto';

@Controller('api/v1/triage/alerts')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  async submitAlert(@Body() dto: SubmitAlertDto) {
    return this.triageService.handleNewAlert(dto);
  }
 //Update permission required for this endpoint
  @Patch(':alertId')
  async updateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.triageService.updateAlertData(alertId, dto);
  }
 //Update permission required for this endpoint
  @Patch(':alertId/auto-close')
  async autoCloseAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AutoCloseAlertDto,
  ) {
    return this.triageService.manualCloseAlert(alertId, dto.status);
  }
}
