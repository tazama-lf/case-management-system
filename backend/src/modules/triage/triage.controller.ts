import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TriageService } from './triage.service';
import { ManualAlertUpdateDTO } from '../../dtos/alerts/alert.dto';
import { HealthCheckResponseDTO, AlertTriageResponseDTO, AlertActionHistoryDTO, AlertDetailsResponseDTO } from '../../dtos/triage/triage.dto';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from 'src/decorators/auth.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';

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
  getTest() {
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
    type: 'string',
    description: 'UUID of the alert to triage',
    example: '123e4567-e89b-12d3-a456-426614174000',
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
  async manualTriage(@Param('alertId') alertId: string, @Body() dto: ManualAlertUpdateDTO, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.handleManualTriage(alertId, dto, userId, tenantId);
  }

  @Get(':alertId/action-history')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get alert action history',
    description: 'Retrieve all actions taken on a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'string',
    description: 'UUID of the alert',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Action history retrieved successfully',
    type: [AlertActionHistoryDTO],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertActionHistory(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.getAlertActionHistory(alertId, tenantId, userId);
  }

  @Get(':alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get alert details',
    description: 'Retrieve detailed information about a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'string',
    description: 'UUID of the alert',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert details retrieved successfully',
    type: AlertDetailsResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertDetails(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.getAlertDetails(alertId, tenantId, userId);
  }
}
