import { Body, Controller, Get, Param, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireAlertTriageRole } from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Cases')
@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  /**
   * System-to-system case creation endpoint (User Story #185)
   * This endpoint is called by external systems (Alert Triage Module, API Portal)
   */
  @Post('system-transmission')
  @RequireAlertTriageRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create case via system-to-system transmission',
    description: 'Creates a new case when fraud is reported via API portal or ATM',
  })
  @ApiBody({ type: SystemCaseCreationDto })
  @ApiResponse({
    status: 201,
    description: 'Case created successfully',
    schema: {
      type: 'object',
      properties: {
        caseId: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        processInstanceId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createCaseSystemTransmission(@Body() dto: SystemCaseCreationDto, @Req() req: AuthenticatedRequest) {
    const clientId = req.user.token.clientId;
    return this.caseService.createCaseSystemTransmission(dto, clientId);
  }

  /**
   * Manual case creation endpoint
   */
  @Post()
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Create case manually',
    description: 'Manual case creation by an analyst or supervisor',
  })
  @ApiBody({ type: CreateCaseDto })
  @ApiResponse({
    status: 201,
    description: 'Case created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCase(@Body() dto: CreateCaseDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.caseService.createCase(dto, userId);
  }

  /**
   * Get case by ID
   */
  @Get(':caseId')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Retrieve case by ID',
    description: 'Get detailed information about a specific case',
  })
  @ApiResponse({
    status: 200,
    description: 'Case retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async getCase(@Param('caseId') caseId: string) {
    return this.caseService.retrieveCase(caseId);
  }

  /**
   * Update case
   */
  @Post(':caseId')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Update case',
    description: 'Update case details such as status, priority, or assignment',
  })
  @ApiBody({ type: UpdateCaseDto })
  @ApiResponse({
    status: 200,
    description: 'Case updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async updateCase(@Param('caseId') caseId: string, @Body() dto: UpdateCaseDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.caseService.updateCase(caseId, dto, userId);
  }

  /**
   * Debug endpoint to check JWT token contents (for troubleshooting)
   * Remove this in production
   */
  @Get('debug-token')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Debug JWT token',
    description: 'Debug endpoint to inspect JWT token contents - remove in production',
  })
  async debugToken(@Req() req: AuthenticatedRequest) {
    return {
      clientId: req.user.token.clientId,
      tenantId: req.user.token.tenantId,
      claims: req.user.token.claims || 'No claims found',
      fullToken: req.user.token,
    };
  }
}
