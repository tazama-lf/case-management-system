import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuthenticated } from 'src/decorators/auth.decorator';

/** Which optional features this deployment has switched on, so the UI shows only those. */
@ApiTags('Features')
@ApiBearerAuth('jwt')
@Controller('api/v1/features')
export class FeaturesController {
  constructor(@Inject('COPILOT_ENABLED') private readonly copilot: boolean) {}

  @Get()
  @RequireAuthenticated()
  @ApiOperation({ summary: 'Optional features switched on in this deployment' })
  features(): { copilot: boolean } {
    return { copilot: this.copilot };
  }
}
