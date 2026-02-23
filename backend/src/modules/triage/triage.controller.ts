import { Body, Controller, Get, Param, Patch, Req, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { TriageService } from './triage.service';
import { ManualAlertUpdateDTO } from '../alert/dto';
import { HealthCheckResponseDTO, AlertTriageResponseDTO } from './dto/triage.dto';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireAnyClaims, RequireInvestigatorOrSupervisorRole } from 'src/decorators/auth.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { Alert } from '@prisma/client-cms';

@ApiTags('Alert Triage')
@Controller('api/v1/triage/alerts')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Get('test')
  @ApiOperation({
    summary: 'Health check',
    description: 'Test endpoint to verify triage service is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthCheckResponseDTO,
  })
  @RequireAnyClaims()
  getTest(): { status: string } {
    return { status: 'ok' };
  }

  @Patch(':alertId')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform manual triage on an alert',
    description: 'Update alert status and priority through manual triage decision',
  })
  @ApiParam({
    name: 'alertId',
    type: 'number',
    description: 'ID of the alert to triage',
    example: 123,
  })
  @ApiBody({ type: ManualAlertUpdateDTO })
  @ApiResponse({
    status: 200,
    description: 'Alert triaged successfully',
    type: AlertTriageResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async manualTriage(
    @Param('alertId') alertId: number,
    @Body() dto: ManualAlertUpdateDTO,
    @Req() req: AuthenticatedRequest,
  ): Promise<Alert> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return await this.triageService.handleManualTriage(alertId, dto, userId, tenantId);
  }
}
