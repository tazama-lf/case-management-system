import { Body, Controller, Post } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';

@Controller('api/v1/triage/alerts')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  async submitAlert(@Body() submitAlertDto: SubmitAlertDto) {
    return this.triageService.handleAlert(submitAlertDto);
  }
}
