import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, HttpCode, HttpStatus, Query, BadRequestException } from '@nestjs/common';
import { CaseService } from './case.service';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto, ApproveCaseClosureDto, RejectCaseClosureDto, ReturnCaseForReviewDto } from './dto/close-case.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import {
  RequireAlertTriageRole,
  RequireInvestigatorRole,
  RequireInvestigatorOrSupervisorRole,
  RequireAnyValidRole,
  RequireSupervisorRole,
  TazamaClaims,
} from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { GetUserCasesQueryDto, GetUserCasesResponseDto } from './dto/get-user-cases.dto';
import { GetAllCasesQueryDto, GetAllCasesResponseDto } from './dto/get-all-cases.dto';
import { ManualCreateCaseDto } from './dto/manual-case-create.dto';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import {RejectCaseReopeningDto} from "./dto/reopen-case.dto";

@ApiTags('Cases')
@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Put(':caseId/abandon')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandon a DRAFT case', description: 'Abandons a DRAFT case, requires reason, closes associated task, and logs the event.' })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to abandon' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string', description: 'Reason for abandoning the case' } } } })
  @ApiResponse({ status: 200, description: 'Case abandoned successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to abandon cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async abandonCase(@Param('caseId') caseId: string, @Body() body: { reason: string }, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');
    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'SUPERVISOR' : 'ANALYST';
    return this.caseService.abandonCase(caseId, body.reason, clientId, tenantId);
  }

  @Put(':caseId/reopen')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reopen an closed case',
    description: 'Reopen a closed case, requires reason, resumes associated task, and logs the event.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to resume' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string', description: 'Reason for resume the case' } } } })
  @ApiResponse({ status: 200, description: 'Case reopened successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to reopen cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async reopenCase(@Param('caseId') caseId: string, @Body() body: { reason: string }, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');
    return this.caseService.reopenCase(caseId, body.reason, clientId, tenantId);
  }

  @Put(':caseId/complete')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a DRAFT case', description: 'Completes a DRAFT case and creates investigation task. Also syncs with Flowable.' })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to complete' })
  @ApiResponse({ status: 200, description: 'Case completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing information' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to complete cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Case is not in DRAFT state' })
  async completeCase(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId } = req.user.token;
    if (!clientId || !tenantId) {
      throw new BadRequestException('Missing clientId or tenantId in auth token');
    }
    return this.caseService.completeCase(caseId, clientId, tenantId);
  }

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
    const { clientId, tenantId } = req.user.token;
    if (!clientId || !tenantId ) throw new BadRequestException('Missing clientId or tenantId');
    return this.caseService.createCaseSystemTransmission(dto, clientId, tenantId);
  }

  @Post('manual')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create case manually',
    description: 'Investigator or Supervisor creates a case manually from an existing alert',
  })
  @ApiBody({ type: ManualCreateCaseDto })
  @ApiResponse({
    status: 201,
    description: 'Case created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            priority: { type: 'string' },
            case_type: { type: 'string' },
          },
        },
        alert: {
          type: 'object',
          properties: {
            alert_id: { type: 'string', format: 'uuid' },
            case_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Missing required fields or alert already has a case' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async createCaseManually(@Body() dto: ManualCreateCaseDto, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'SUPERVISOR' : 'ANALYST';

    return this.caseService.manualCaseCreate(dto, clientId, tenantId, role);
  }

  @Put(':caseId/close')
  @RequireInvestigatorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close a case and submit for approval',
    description: `Investigator closes a case after investigation is complete. 
  Validates all preconditions and provides detailed error messages if closure fails.
  Creates an approval task for supervisor review.
  
  **Preconditions:**
  - Case must exist and be accessible by the investigator
  - Case status must be STATUS_20_IN_PROGRESS
  - Must have "Investigate Case" task
  - Investigation task must be assigned to the requesting user
  - Investigation task status must be STATUS_20_IN_PROGRESS
  - All required closure information must be provided`,
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
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        errors: {
          type: 'array',
          items: { type: 'string' },
          example: ['Final notes are required and must be at least 20 characters']
        },
        caseId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case not found or no permission',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Case not found or you don\'t have permission to close it' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case or task not in correct state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        currentStatus: { type: 'string' },
        requiredStatus: { type: 'string' },
        caseId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - System error during closure',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'System error occurred during case closure' },
        caseId: { type: 'string' },
        error: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async closeCase(
      @Param('caseId') caseId: string,
      @Body() dto: CloseCaseDto,
      @Req() req: AuthenticatedRequest
  ) {
    const { clientId, tenantId } = req.user.token;
    if (!clientId || !tenantId) {
      throw new BadRequestException('Missing clientId or tenantId in auth token');
    }
    return this.caseService.closeCase(caseId, dto, clientId, tenantId);
  }

  @Get('all')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get all cases (Supervisor only)',
    description: 'Retrieves all cases in the system with filtering options. Requires supervisor permissions.',
  })
  @ApiQuery({ type: GetAllCasesQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetAllCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires supervisor role' })
  async getAllCases(@Query() query: GetAllCasesQueryDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.caseService.getAllCases(query, userId);
  }

  @Get('user/assigned')
  @RequireInvestigatorOrSupervisorRole()
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
  async getUserCases(@Query() query: GetUserCasesQueryDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.caseService.getUserCases(userId, query);
  }

  @Get('user/:userId/assigned')
  @RequireSupervisorRole()
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
    if (requestingUserId !== targetUserId) {
    }

    return this.caseService.getUserCases(targetUserId, query);
  }

  @Get('user/workload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get case workload statistics',
    description: "Get summary statistics of user's case workload",
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
            STATUS_20_IN_PROGRESS: 10,
            STATUS_02_READY_FOR_ASSIGNMENT: 5,
          },
        },
        casesByPriority: {
          type: 'object',
          example: {
            CRITICAL: 2,
            URGENT: 5,
            NEW: 8,
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

  @Get(':caseId')
  @RequireAnyValidRole() // Allow any valid CMS role to view case details
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

  @Post(':caseId')
  @RequireAnyValidRole() // Allow any valid CMS role to update cases
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

  @Put(':caseId/approve')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve case closure',
    description: `Supervisor approves case closure with final outcome.
  Comprehensive validation ensures all preconditions are met.
  
  **Validation Checks:**
  - Case exists and has complete information
  - Case status is STATUS_22_PENDING_FINAL_APPROVAL
  - "Approve case closure" task exists and is unassigned
  - All other tasks are completed
  - Investigation task is completed
  - Closure recommendation exists
  
  **On Success:**
  - Updates case to final status (81/82/83)
  - Completes approval task
  - Notifies investigator
  - Logs to audit trail
  
  **On Failure:**
  - Provides detailed error message
  - No changes made to case or tasks
  - Failure logged to audit trail`,
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to approve closure for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ApproveCaseClosureDto,
    examples: {
      confirmed: {
        summary: 'Approve as confirmed',
        value: {
          finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
          supervisorComments: 'Investigation findings are thorough and well-documented. Approving closure as confirmed fraud case.'
        }
      },
      refuted: {
        summary: 'Approve as refuted',
        value: {
          finalOutcome: 'STATUS_81_CLOSED_REFUTED',
          supervisorComments: 'Evidence clearly shows no fraud occurred. Alert was false positive.'
        }
      },
      inconclusive: {
        summary: 'Approve as inconclusive',
        value: {
          finalOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
          supervisorComments: 'Investigation conducted properly but insufficient evidence to make definitive determination.'
        }
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case closure approved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid outcome or missing case information',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        providedOutcome: { type: 'string' },
        validOutcomes: {
          type: 'array',
          items: { type: 'string' },
          example: ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE']
        },
        missingInformation: {
          type: 'array',
          items: { type: 'string' },
          example: ['Completed investigation task', 'Investigation closure recommendation']
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in STATUS_22_PENDING_FINAL_APPROVAL or incomplete tasks',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        currentStatus: { type: 'string' },
        requiredStatus: { type: 'string', example: 'STATUS_22_PENDING_FINAL_APPROVAL' },
        incompleteTasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - System error during approval',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'System error occurred during case closure approval' },
        caseId: { type: 'string' },
        error: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        action: { type: 'string', example: 'approveCaseClosure' },
      },
    },
  })
  async approveCaseClosure(
      @Param('caseId') caseId: string,
      @Body() dto: ApproveCaseClosureDto,
      @Req() req: AuthenticatedRequest
  ) {
    const supervisorId = req.user.token.clientId;
    if (!supervisorId) {
      throw new BadRequestException('Missing supervisor ID in auth token');
    }
    return this.caseService.approveCaseClosure(
        caseId,
        dto.finalOutcome,
        dto.supervisorComments,
        supervisorId
    );
  }

  @Put(':caseId/reject')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject case closure',
    description: `Supervisor rejects case closure and creates new investigation task.
  The investigation task is automatically assigned to the original investigator who submitted the closure.
  Case status returns to STATUS_20_IN_PROGRESS.
  
  **Process:**
  1. Validates case is in STATUS_22_PENDING_FINAL_APPROVAL
  2. Completes the "Approve case closure" task
  3. Updates case to STATUS_20_IN_PROGRESS
  4. Creates new "Investigate Case" task assigned to original investigator
  5. Adds supervisor feedback as comment
  6. Notifies investigator of rejection`,
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to reject closure for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: RejectCaseClosureDto,
    description: 'Rejection details with supervisor feedback (minimum 20 characters)',
    examples: {
      example1: {
        summary: 'Incomplete investigation',
        value: {
          rejectionReason: 'The investigation is incomplete. Please conduct additional interviews with the witnesses listed in the evidence log and provide a comprehensive timeline of events.'
        }
      },
      example2: {
        summary: 'Missing evidence',
        value: {
          rejectionReason: 'Critical evidence is missing. The transaction logs referenced in your summary have not been uploaded. Please attach all relevant documentation before resubmitting.'
        }
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case closure rejected successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Case closure rejected and returned for investigation'
        },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_20_IN_PROGRESS' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        completed_approval_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_30_COMPLETED' },
          },
        },
        new_investigation_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Investigate Case' },
            assigned_to: { type: 'string', format: 'uuid', description: 'Original investigator user ID' },
            status: { type: 'string', example: 'STATUS_10_ASSIGNED' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid rejection reason or unable to determine original investigator',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in STATUS_22_PENDING_FINAL_APPROVAL state',
  })
  async rejectCaseClosure(
      @Param('caseId') caseId: string,
      @Body() dto: RejectCaseClosureDto,
      @Req() req: AuthenticatedRequest
  ) {
    const supervisorId = req.user.token.clientId;
    if (!supervisorId) {
      throw new BadRequestException('Missing supervisor ID in auth token');
    }
    return this.caseService.rejectCaseClosure(caseId, dto.rejectionReason, supervisorId);
  }

  @Put(':caseId/approve-creation')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve case creation',
    description:
        'Supervisor approves manual case creation. Updates case to READY_FOR_ASSIGNMENT, ' +
        'completes approval task, and creates Investigate Case task in Flowable investigations queue.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to approve creation for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Case creation approved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_02_READY_FOR_ASSIGNMENT' },
            priority: { type: 'string', example: 'URGENT' },
            case_type: { type: 'string', example: 'FRAUD' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        approvedTask: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Approve Case Creation' },
            status: { type: 'string', example: 'STATUS_30_COMPLETED' },
            assigned_user_id: { type: 'string', format: 'uuid' },
          },
        },
        newTask: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Investigate case' },
            status: { type: 'string', example: 'STATUS_01_UNASSIGNED' },
            candidateGroup: { type: 'string', example: 'investigations' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing required fields',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case has missing required fields' },
        missingFields: {
          type: 'array',
          items: { type: 'string' },
          example: ['priority', 'case_type'],
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case not found' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in PENDING_CASE_CREATION_APPROVAL state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case is not pending creation approval' },
        currentStatus: { type: 'string', example: 'STATUS_00_DRAFT' },
        requiredStatus: { type: 'string', example: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' },
      },
    },
  })
  async approveCaseCreation(
      @Param('caseId') caseId: string,
      @Req() req: AuthenticatedRequest,
  ) {
    const { clientId: supervisorId, tenantId } = req.user.token;

    if (!supervisorId || !tenantId) {
      throw new BadRequestException('Missing supervisor ID or tenant ID in auth token');
    }

    return this.caseService.approveCaseCreation(caseId, supervisorId, tenantId);
  }

  @Put(':caseId/reject-creation')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject case creation',
    description:
        'Supervisor rejects manual case creation. Returns case to DRAFT status, ' +
        'completes approval task, and creates Complete New Case task assigned to the original creator.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to reject creation for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for rejecting the case creation (minimum 10 characters)',
          example: 'Missing critical information about the alert source and transaction details',
          minLength: 10,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case creation rejected successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_00_DRAFT' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        completedTask: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Approve Case Creation' },
            status: { type: 'string', example: 'STATUS_30_COMPLETED' },
          },
        },
        newTask: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Complete New Case' },
            status: { type: 'string', example: 'STATUS_10_ASSIGNED' },
            assigned_user_id: { type: 'string', format: 'uuid' },
            description: { type: 'string', example: 'Revise and complete the case as per supervisor feedback' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing/invalid reason or invalid case state',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Rejection reason is required and must be at least 10 characters',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in PENDING_CASE_CREATION_APPROVAL state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case is not pending creation approval' },
        currentStatus: { type: 'string' },
        requiredStatus: { type: 'string', example: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' },
      },
    },
  })
  async rejectCaseCreation(
      @Param('caseId') caseId: string,
      @Body() body: { reason: string },
      @Req() req: AuthenticatedRequest,
  ) {
    const { clientId: supervisorId, tenantId } = req.user.token;

    if (!supervisorId || !tenantId) {
      throw new BadRequestException('Missing supervisor ID or tenant ID in auth token');
    }

    if (!body.reason || body.reason.trim().length < 10) {
      throw new BadRequestException(
          'Rejection reason is required and must be at least 10 characters',
      );
    }

    return this.caseService.rejectCaseCreation(caseId, supervisorId, tenantId, body.reason);
  }

  @Put(':caseId/approve-reopening')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve case reopening',
    description: `Supervisor approves case reopening request. Behavior depends on original requester role:
  - If ANALYST/INVESTIGATOR requested: Case assigned directly to that analyst (STATUS_10_ASSIGNED)
  - If SUPERVISOR requested OR role unclear: Case assigned to investigations queue (STATUS_02_READY_FOR_ASSIGNMENT)
 
  **Note:** The system checks for role values like 'ANALYST', 'INVESTIGATOR', 'CMS_ANALYST', 'CMS_INVESTIGATOR' (case-insensitive).
  Creates "Investigate Case" task and notifies relevant parties.`,
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to approve reopening for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Case reopening approved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Case reopening approved' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['STATUS_10_ASSIGNED', 'STATUS_02_READY_FOR_ASSIGNMENT'],
              example: 'STATUS_10_ASSIGNED'
            },
            case_owner_user_id: { type: 'string', format: 'uuid', nullable: true },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        completed_approval_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_30_COMPLETED' },
          },
        },
        investigation_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Investigate Case' },
            status: {
              type: 'string',
              enum: ['STATUS_10_ASSIGNED', 'STATUS_01_UNASSIGNED']
            },
            assigned_to: {
              type: 'string',
              description: 'User ID or candidate group name'
            },
            candidateGroup: { type: 'string', example: 'investigations' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid case state or missing information',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks supervisor role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case is not in STATUS_31_REOPENED state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        currentStatus: { type: 'string' },
        requiredStatus: { type: 'string', example: 'STATUS_31_REOPENED' },
        caseId: { type: 'string', format: 'uuid' },
      },
    },
  })
  async approveCaseReopening(
      @Param('caseId') caseId: string,
      @Req() req: AuthenticatedRequest
  ) {
    const { clientId: supervisorId, tenantId } = req.user.token;

    if (!supervisorId || !tenantId) {
      throw new BadRequestException('Missing supervisor ID or tenant ID in auth token');
    }

    return this.caseService.approveCaseReopening(caseId, supervisorId, tenantId);
  }

  @Put(':caseId/reject-reopening')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject case reopening',
    description: `Supervisor rejects case reopening request. Case is restored to its original closed status (7*/8*).
  Notifies the original requester of the rejection with detailed reason.`,
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to reject reopening for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: RejectCaseReopeningDto,
    description: 'Rejection details including mandatory reason (minimum 20 characters)',
    examples: {
      example1: {
        summary: 'Insufficient evidence',
        value: {
          rejectionReason: 'Insufficient new evidence to warrant reopening. The original investigation was comprehensive and all available leads were exhausted.'
        }
      },
      example2: {
        summary: 'Duplicate request',
        value: {
          rejectionReason: 'This case reopening request is a duplicate. The same concerns were already addressed in the original investigation findings.'
        }
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case reopening rejected successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Case reopening rejected' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: [
                'STATUS_81_CLOSED_REFUTED',
                'STATUS_82_CLOSED_CONFIRMED',
                'STATUS_83_CLOSED_INCONCLUSIVE',
                'STATUS_71_AUTOCLOSED_CONFIRMED',
                'STATUS_72_AUTOCLOSED_REFUTED'
              ],
              example: 'STATUS_82_CLOSED_CONFIRMED'
            },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        completed_task: {
          type: 'object',
          properties: {
            task_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_30_COMPLETED' },
          },
        },
        rejection_reason: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing or insufficient rejection reason',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Rejection reason must be at least 20 characters' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks supervisor role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case is not in STATUS_31_REOPENED state',
  })
  async rejectCaseReopening(
      @Param('caseId') caseId: string,
      @Body() dto: RejectCaseReopeningDto,
      @Req() req: AuthenticatedRequest
  ) {
    const { clientId: supervisorId, tenantId } = req.user.token;

    if (!supervisorId || !tenantId) {
      throw new BadRequestException('Missing supervisor ID or tenant ID in auth token');
    }

    if (!dto.rejectionReason || dto.rejectionReason.trim().length < 20) {
      throw new BadRequestException(
          'Rejection reason is required and must be at least 20 characters'
      );
    }

    return this.caseService.rejectCaseReopening(
        caseId,
        dto.rejectionReason,
        supervisorId,
        tenantId
    );
  }

  @Put(':caseId/return-for-review')
  @RequireSupervisorRole() // Only supervisors can return cases for review
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return case for additional review',
    description: 'Supervisor returns case to STATUS_20_IN_PROGRESS for additional investigation work.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to return for review',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: ReturnCaseForReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Case returned for review successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case returned for review' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_20_IN_PROGRESS' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Case not in pending approval status',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - User lacks supervisor permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  async returnCaseForReview(@Param('caseId') caseId: string, @Body() dto: ReturnCaseForReviewDto, @Req() req: AuthenticatedRequest) {
    const supervisorId = req.user.token.clientId;
    if (!supervisorId) {
      throw new BadRequestException('Missing supervisor ID in auth token');
    }
    return this.caseService.returnCaseForReview(caseId, dto.reviewComments, supervisorId);
  }
}