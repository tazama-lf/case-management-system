import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckResponseDTO } from './modules/triage/dto/triage.dto';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Test endpoint to verify Health check',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthCheckResponseDTO,
  })
  getTest(): { status: string } {
    return { status: 'UP!' };
  }
}
