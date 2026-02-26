import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ProcessAlertService } from './process-alert.service';
import { RequireAuthenticated } from '../../decorators/auth.decorator';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateAlertDTO } from '../alert/dto';
import { AuthenticatedRequest } from '../../utils/types/auth.types';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { Audit } from '../audit/decorators/audit-log.decorator';

@Controller('ingest-alert')
@UseGuards(TazamaAuthGuard)
export class ProcessAlertController {
  constructor(private readonly processAlertService: ProcessAlertService) {}

  @Post('')
  @RequireAuthenticated()
  @Audit()
  @ApiOperation({
    summary: 'Process incoming alert event',
    description: 'Internal endpoint for alert ingestion from event stream',
  })
  @ApiBody({ type: CreateAlertDTO })
  @ApiResponse({ status: 201, description: 'Alert processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async processIncomingAlert(@Body() dto: CreateAlertDTO, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId || !userId) throw new BadRequestException('Missing tenantId or userId');
    await this.processAlertService.processIncomingAlert(dto, 'REST API', userId, tenantId);
  }
}
