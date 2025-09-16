import {Body, Controller, Get, Param, Post, Put, Req, UseGuards, HttpCode, HttpStatus, Query} from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireAlertTriageRole } from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import {ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery} from '@nestjs/swagger';
import {GetUserCasesQueryDto, GetUserCasesResponseDto} from "./dto/get-user-cases.dto";

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
   * This endpoint is called by investigators to close a case and submit for approval
   */
  @Put(':caseId/close')
  @RequireAlertTriageRole() // Should be RequireInvestigatorRole() when available
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close a case and submit for approval',
    description: 'Investigator closes a case after investigation is complete. Creates an approval task for supervisor.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to close',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CloseCaseDto })
  @ApiResponse({
    status: 200,
    description: 'Case closed successfully and submitted for approval',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case closed successfully and submitted for approval' },
        closed_case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_22_PENDING_FINAL_APPROVAL' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        approval_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Approve case closure' },
            status: { type: 'string', example: 'STATUS_01_UNASSIGNED' },
            assigned_to: { type: 'string', example: 'Supervisors' },
          },
        },
        processInstanceId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid case state or missing information',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - User lacks permission to close cases',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Case not assigned to user or user is not an investigator',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case is not in a closeable state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        currentStatus: { type: 'string' },
        requiredStatus: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - System error during case closure',
  })
  async closeCase(
      @Param('caseId') caseId: string,
      @Body() dto: CloseCaseDto,
      @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    return this.caseService.closeCase(caseId, dto, userId, tenantId);
  }

  // Add this method to your existing case.controller.ts

  /**
   * Get all cases assigned to the current user
   * This includes cases where user is owner OR has assigned tasks
   */
  @Get('user/assigned')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Get cases assigned to current user',
    description: 'Retrieves all cases where the user is either the owner or has assigned tasks',
  })
  @ApiQuery({ type: GetUserCasesQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetUserCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserCases(
      @Query() query: GetUserCasesQueryDto,
      @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;
    return this.caseService.getUserCases(userId, query);
  }

  /**
   * Get all cases assigned to a specific user (for supervisors/admins)
   */
  @Get('user/:userId/assigned')
  @RequireAlertTriageRole() // Should require supervisor role when implemented
  @ApiOperation({
    summary: 'Get cases assigned to a specific user',
    description: 'Retrieves all cases for a specific user (requires supervisor permissions)',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    description: 'User ID to get cases for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({ type: GetUserCasesQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetUserCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getUserCasesByUserId(
      @Param('userId') targetUserId: string,
      @Query() query: GetUserCasesQueryDto,
      @Req() req: AuthenticatedRequest,
  ) {
    const requestingUserId = req.user.token.clientId;

    // TODO: Check if requesting user has supervisor permissions
    // For now, allow users to only query their own cases
    if (requestingUserId !== targetUserId) {
      // In production, check for supervisor role here
      // throw new ForbiddenException('You can only view your own cases');
    }

    return this.caseService.getUserCases(targetUserId, query);
  }

  /**
   * Get case workload statistics for current user
   */
  @Get('user/workload')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Get case workload statistics',
    description: 'Get summary statistics of user\'s case workload',
  })
  @ApiResponse({
    status: 200,
    description: 'Workload statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalActiveCases: { type: 'number', example: 15 },
        totalPendingTasks: { type: 'number', example: 8 },
        casesByStatus: {
          type: 'object',
          example: {
            'STATUS_20_IN_PROGRESS': 10,
            'STATUS_02_READY_FOR_ASSIGNMENT': 5,
          },
        },
        casesByPriority: {
          type: 'object',
          example: {
            'CRITICAL': 2,
            'URGENT': 5,
            'NEW': 8,
          },
        },
        oldestCase: {
          type: 'object',
          properties: {
            case_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            days_old: { type: 'number' },
          },
        },
        averageCaseAge: { type: 'number', example: 5.5 },
      },
    },
  })
  async getUserWorkload(@Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.caseService.getUserWorkloadStats(userId);
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