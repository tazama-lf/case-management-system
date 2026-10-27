import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuthenticated, RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { COPILOT_FEATURES, type CopilotFeatures, strategyName } from './copilot.config';
import { ModelProviderService } from './model-provider.service';

/** Which optional features this deployment has switched on, so the UI shows only those. Always present. */
@ApiTags('Features')
@ApiBearerAuth('jwt')
@Controller('api/v1/features')
@UseGuards(TazamaAuthGuard)
export class FeaturesController {
  constructor(@Inject(COPILOT_FEATURES) private readonly features: CopilotFeatures) {}

  @Get()
  @RequireAuthenticated()
  @ApiOperation({ summary: 'Optional features switched on in this deployment' })
  list(): { copilotInvestigation: boolean; copilotSar: boolean } {
    return { copilotInvestigation: this.features.investigation, copilotSar: this.features.sar };
  }
}

/** Which model the copilot uses and whether it answers. Present when either copilot feature is on. */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot')
@UseGuards(TazamaAuthGuard)
export class CopilotStatusController {
  constructor(private readonly models: ModelProviderService) {}

  @Get('status')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Which model the copilot uses (bundled, bring-your-own-key or off), its licence, and whether it is reachable' })
  async status(): Promise<unknown> {
    return { ...this.models.info(), reachable: await this.models.reachable(), strategy: strategyName() };
  }
}
