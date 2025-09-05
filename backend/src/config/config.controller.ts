import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireAlertTriageRole } from 'src/auth/auth.decorator';

export interface SystemConfig {
  triageType: 'AI' | 'MANUAL' | 'DISABLED';
  confidenceThreshold: number;
  interdictionEnabled: boolean;
}

@Controller('api/v1/config')
@UseGuards(TazamaAuthGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('system')
  @RequireAlertTriageRole()
  getSystemConfig(): SystemConfig {
    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase() as 'AI' | 'MANUAL' | 'DISABLED';
    const confidenceThreshold = this.configService.get<number>('CONFIDENCE_THRESHOLD', 95);
    const interdictionEnabled = this.configService.get<string>('CLIENT_SYSTEM_INTERDICTION_ENABLED', 'true').toLowerCase() === 'true';

    return {
      triageType,
      confidenceThreshold,
      interdictionEnabled,
    };
  }
}
