import { Body, Controller, Get, Param, Patch, Req, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { TriageService } from './triage.service';
import { ManualAlertUpdateDTO } from '../alert/dto';
import { AlertTriageResponseDTO } from './dto/triage.dto';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from 'src/decorators/auth.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { Alert } from '@prisma/client-cms';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { AlertNavigatorDto } from './dto/alert-navigator.dto';
import { TransactionDetailDto } from './dto/transaction-detail.dto';

@ApiTags('Alert Triage')
@Controller('api/v1/triage/alerts')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Patch(':alertId')
  @RequireInvestigatorOrSupervisorRole()
  @Audit()
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

  @Get(':alertId/navigator')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get alert navigator details',
    description: 'Retrieve all details for Alert Navigator view',
  })
  @ApiParam({
    name: 'alertId',
    type: 'number',
    description: 'ID of the alert to triage',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Alert navigator details',
    type: AlertNavigatorDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertNavigator(@Param('alertId') alertId: number, @Req() req: AuthenticatedRequest): Promise<AlertNavigatorDto> {
    const userId = req.user.token.clientId;
    const { token } = req.user;
    const { tenantId } = token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');

    const trimmedAlertId = alertId;

    return await this.triageService.getAlertNavigator(trimmedAlertId, tenantId, userId);
  }

  @Get('transactions/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Retrieve detailed metadata of a transaction including debtor, creditor, amounts, and links',
  })
  @ApiParam({
    name: 'transactionId',
    type: 'string',
    description: 'Transaction ID (MsgId)',
    example: 'f8b8...',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
    type: TransactionDetailDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionDetail(
    @Param('transactionId') transactionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<TransactionDetailDto> {
    const userId = req.user.token.clientId;
    const { token } = req.user;
    const { tenantId } = token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');

    const trimmedTransactionId = transactionId.trim();

    return await this.triageService.getTransactionDetail(trimmedTransactionId, tenantId, userId);
  }
}
