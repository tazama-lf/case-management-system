import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, HttpCode, HttpStatus, Query, BadRequestException } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
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
import { AlertMessageDto } from '../nats/dto/AlertMessageDto.dto';

@ApiTags('Cases')
@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

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
  async createCaseSystemTransmission(@Body() dto: AlertMessageDto, @Req() req: AuthenticatedRequest) {
    const clientId = req.user.token.clientId;
    return this.caseService.createCaseSystemTransmission(dto, clientId);
  }

  @Post('manual')
  @RequireInvestigatorOrSupervisorRole()
  async createCaseManually(@Body() dto: ManualCreateCaseDto, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'SUPERVISOR' : 'ANALYST';

    return this.caseService.manualCaseCreate(dto, clientId, tenantId, role);
  }

  @Put(':caseId/close')
  @RequireInvestigatorRole() // Investigators can close cases
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
  async closeCase(@Param('caseId') caseId: string, @Body() dto: CloseCaseDto, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId } = req.user.token;
    if (!clientId || !tenantId) {
      throw new BadRequestException('Missing clientId or tenantId in auth token');
    }
    return this.caseService.closeCase(caseId, dto, clientId, tenantId);
  }

  @Get('all')
  @RequireInvestigatorOrSupervisorRole() // Investigators and supervisors can access all cases
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
  @RequireInvestigatorOrSupervisorRole() // Investigators and supervisors can access their assigned cases
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
  @RequireSupervisorRole() // Only supervisors can access cases for any user
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
  @RequireInvestigatorOrSupervisorRole() // Investigators and supervisors can access workload stats
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
  @RequireSupervisorRole() // Only supervisors can approve case closures
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve case closure (Story 9A)',
    description:
        'Supervisor approves the case closure with final outcome. Updates case to final status (81/82/83) and completes approval task.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to approve closure for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: ApproveCaseClosureDto })
  @ApiResponse({
    status: 200,
    description: 'Case closure approved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case closure approved' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'] },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Case not in pending approval status or invalid final outcome',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - User lacks supervisor permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case is not in STATUS_22_PENDING_FINAL_APPROVAL state',
  })
  async approveCaseClosure(@Param('caseId') caseId: string, @Body() dto: ApproveCaseClosureDto, @Req() req: AuthenticatedRequest) {
    const supervisorId = req.user.token.clientId;
    if (!supervisorId) {
      throw new BadRequestException('Missing supervisor ID in auth token');
    }
    return this.caseService.approveCaseClosure(caseId, dto.finalOutcome, dto.supervisorComments, supervisorId);
  }

  @Put(':caseId/reject')
  @RequireSupervisorRole() // Only supervisors can reject case closures
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject case closure',
    description: 'Supervisor rejects the case closure and returns case to STATUS_03_RETURNED for further investigation.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case to reject closure for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: RejectCaseClosureDto })
  @ApiResponse({
    status: 200,
    description: 'Case closure rejected successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Case closure rejected' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', example: 'STATUS_03_RETURNED' },
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
  async rejectCaseClosure(@Param('caseId') caseId: string, @Body() dto: RejectCaseClosureDto, @Req() req: AuthenticatedRequest) {
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