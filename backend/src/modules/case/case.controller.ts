import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, HttpCode, HttpStatus, Query, BadRequestException } from '@nestjs/common';
import { CaseService } from './case.service';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import {
  RequireInvestigatorRole,
  RequireInvestigatorOrSupervisorRole,
  RequireInvestigatorOrSupervisorRoleOrComplianceRole,
  RequireSupervisorRole,
} from '../../decorators/auth.decorator';
import { AuthenticatedRequest } from '../../utils/types/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { extractUserData } from '../../utils/helperFunction';
import {
  GetUserCasesQueryDto,
  GetUserCasesResponseDto,
  GetAllCasesQueryDto,
  GetAllCasesResponseDto,
  ManualCreateCaseDto,
  RejectCaseReopeningDto,
  RequestReopenCaseDto,
  RequestAbandonCaseDto,
  RequestSuspendCaseDto,
  UpdateCaseDto,
  CloseCaseDto,
  ApproveCaseClosureDto,
  RejectCaseClosureDto,
  ReturnCaseForReviewDto,
  RequestResumeCaseDto,
  ManualCaseCreatedResponseDto,
  CloseCaseValidationErrorResponseDto,
  CaseNotFoundResponseDto,
  CaseConflictResponseDto,
  CaseErrorResponseDto,
  ApproveCaseClosureBadRequestResponseDto,
  RejectCaseClosureResponseDto,
  ApproveCaseCreationResponseDto,
  CaseMissingFieldsResponseDto,
  CaseCreationConflictResponseDto,
  RejectCaseCreationBodyDto,
  RejectCaseCreationResponseDto,
  RejectCaseCreationBadRequestResponseDto,
  ApproveCaseReopeningResponseDto,
  CaseReopeningConflictResponseDto,
  RejectCaseReopeningResponseDto,
  RejectReopeningBadRequestResponseDto,
  ReturnCaseForReviewResponseDto,
} from './dto';
import { SimpleMessageResponseDto } from 'src/dtos/simple-message-response.dto';
import { UserWorkloadResponseDto } from './dto/user-workload-response.dto';

@ApiTags('Cases')
@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  // @Get(':caseId/action-history')
  // @RequireInvestigatorOrSupervisorRole()
  // @ApiOperation({
  //   summary: 'Get case action history',
  //   description: 'Retrieve all actions taken on a specific case',
  // })
  // @ApiParam({
  //   name: 'caseId',
  //   type: 'string',
  //   description: 'UUID of the case',
  //   example: '123e4567-e89b-12d3-a456-426614174000',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Action history retrieved successfully',
  //   schema: {
  //     type: 'array',
  //     items: {
  //       type: 'object',
  //       properties: {
  //         action_id: { type: 'string', format: 'uuid' },
  //         action_type: { type: 'string' },
  //         user_id: { type: 'string', format: 'uuid' },
  //         note: { type: 'string' },
  //         created_at: { type: 'string', format: 'date-time' },
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 404, description: 'Alert not found' })
  // async getCaseActionHistory(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
  //   const userId = req.user.token.clientId;
  //   const tenantId = req.user.token.tenantId;
  //   if (!tenantId) throw new BadRequestException('Missing tenantId');
  //   if (!userId) throw new BadRequestException('Missing userId');
  //   return this.caseService.getCaseActionHistory(caseId, tenantId, userId);
  // }

  @Put(':caseId/abandon')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Abandon a DRAFT case',
    description: 'Abandons a DRAFT case, requires reason, closes associated task, and logs the event.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to abandon' })
  @ApiBody({ type: RequestAbandonCaseDto })
  @ApiResponse({ status: 200, description: 'Case abandoned successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to abandon cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async abandonCase(@Param('caseId') caseId: number, @Body() body: RequestAbandonCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId } = extractUserData(req);
    return await this.caseService.abandonCase(caseId, body.reason, userId, tenantId);
  }

  @Put(':caseId/reopen')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reopen an closed case',
    description: 'Reopen a closed case, requires reason, resumes associated task, and logs the event.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to resume' })
  @ApiBody({ type: RequestReopenCaseDto })
  @ApiResponse({ status: 200, description: 'Case reopened successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to reopen cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async reopenCase(@Param('caseId') caseId: number, @Body() body: RequestReopenCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, validateClaim } = extractUserData(req);
    return await this.caseService.reopenCase(caseId, body.reason, userId, tenantId, validateClaim);
  }

  @Put(':caseId/suspend')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend an in-progress case',
    description: 'Suspends a an in-progress case, requires reason, blocks associated task, and logs the event.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to suspend' })
  @ApiBody({ type: RequestSuspendCaseDto })
  @ApiResponse({ status: 200, description: 'Case suspended successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to suspend cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async suspendCase(@Param('caseId') caseId: number, @Body() body: RequestSuspendCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, userInfo, role } = extractUserData(req);
    return await this.caseService.suspendCase(caseId, body.reason, body.taskIds, userId, tenantId, userInfo, role);
  }

  @Put(':caseId/resume')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume an suspended case',
    description: 'Resumes a suspended case, requires reason, resumes associated task, and logs the event.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to resume' })
  @ApiBody({ type: RequestResumeCaseDto })
  @ApiResponse({ status: 200, description: 'Case resumed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to resume cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  async resumeCase(@Param('caseId') caseId: number, @Body() body: RequestResumeCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, userInfo } = extractUserData(req);
    return await this.caseService.resumeCase(caseId, body.reason, userId, tenantId, userInfo);
  }

  @Put(':caseId/complete')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a DRAFT case',
    description: 'Completes a DRAFT case and creates investigation task. Also syncs with Flowable.',
  })
  @ApiParam({ name: 'caseId', type: 'string', description: 'UUID of the case to complete' })
  @ApiResponse({ status: 200, description: 'Case completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid case state or missing information' })
  @ApiResponse({ status: 401, description: 'Unauthorized - User lacks permission to complete cases' })
  @ApiResponse({ status: 404, description: 'Not Found - Case not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Case is not in DRAFT state' })
  async completeCase(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId } = extractUserData(req);
    return await this.caseService.completeCase(caseId, userId, tenantId);
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
    type: ManualCaseCreatedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Missing required fields or alert already has a case' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async createCaseManually(@Body() dto: ManualCreateCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, role } = extractUserData(req);
    return await this.caseService.manualCaseCreate(dto, userId, tenantId, role);
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
    type: CloseCaseValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case not found or no permission',
    type: CaseNotFoundResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case or task not in correct state',
    type: CaseConflictResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - System error during closure',
    type: CaseErrorResponseDto,
  })
  async closeCase(@Param('caseId') caseId: number, @Body() dto: CloseCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, validateClaim } = extractUserData(req);
    return await this.caseService.closeCase(caseId, dto, userId, tenantId, validateClaim);
  }

  @Get('all')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get all cases',
    description: 'Retrieves cases based on user role. Investigators see unassigned or assigned to them. Supervisors see all cases.',
  })
  @ApiQuery({ type: GetAllCasesQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetAllCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires investigator or supervisor role' })
  async getAllCases(@Query() query: GetAllCasesQueryDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, claims } = extractUserData(req);

    // Check if user is investigator (not supervisor/admin)
    const isInvestigator =
      claims.includes('CMS_INVESTIGATOR') &&
      !claims.includes('CMS_SUPERVISOR') &&
      !claims.includes('CMS_ADMIN') &&
      !claims.includes('CMS_COMPLIANCE_OFFICER');
    const isComplianceOfficer = claims.includes('CMS_COMPLIANCE_OFFICER');

    return await this.caseService.getAllCases(query, tenantId, isInvestigator ? userId : undefined, isComplianceOfficer);
  }

  @Get('user/assigned')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    const { userId, isComplianceOfficer } = extractUserData(req);
    return await this.caseService.getUserCases(userId, query, isComplianceOfficer);
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
    const { userId: requestingUserId } = extractUserData(req);
    if (requestingUserId !== targetUserId) {
      /* empty */
    }

    return await this.caseService.getUserCases(targetUserId, query);
  }

  @Get('user/workload')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get case workload statistics', description: 'Get summary statistics of user\'s case workload' })
  @ApiResponse({ status: 200, description: 'Workload statistics retrieved successfully', type: UserWorkloadResponseDto })
  async getUserWorkload(@Req() req: AuthenticatedRequest) {
    const { userId, isComplianceOfficer } = extractUserData(req);
    return await this.caseService.getUserWorkloadStats(userId, isComplianceOfficer);
  }

  @Get(':caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Retrieve case by ID', description: 'Get detailed information about a specific case' })
  @ApiResponse({ status: 200, description: 'Case retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Compliance officers can only access confirmed closed cases' })
  async getCase(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
    const { isComplianceOfficer } = extractUserData(req);
    return await this.caseService.retrieveCase(caseId, isComplianceOfficer);
  }

  @Get('parentId/:caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Retrieve sub case by parent ID',
    description: 'Get detailed information about sub cases associated with a parent case',
  })
  @ApiResponse({ status: 200, description: 'Case retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only relevant users can only access cases information' })
  async getSubCasesDetails(@Param('caseId') caseId: number) {
    return await this.caseService.getSubCasesDetails(caseId);
  }

  @Put(':caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
  async updateCase(@Param('caseId') caseId: number, @Body() dto: UpdateCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId } = extractUserData(req);
    return await this.caseService.updateCase(caseId, dto, userId);
  }

  @Post(':caseId/complete-case-creation')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Complete case creation',
    description: 'Complete the creation of a case by updating its details such as status, priority, or assignment',
  })
  @ApiBody({ type: UpdateCaseDto })
  @ApiResponse({
    status: 200,
    description: 'Case creation completed successfully',
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async completeCaseCreation(@Param('caseId') caseId: number, @Body() dto: UpdateCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, role } = extractUserData(req);
    return await this.caseService.completeCaseCreation(caseId, dto, userId, role);
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
          supervisorComments: 'Investigation findings are thorough and well-documented. Approving closure as confirmed fraud case.',
        },
      },
      refuted: {
        summary: 'Approve as refuted',
        value: {
          finalOutcome: 'STATUS_81_CLOSED_REFUTED',
          supervisorComments: 'Evidence clearly shows no fraud occurred. Alert was false positive.',
        },
      },
      inconclusive: {
        summary: 'Approve as inconclusive',
        value: {
          finalOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
          supervisorComments: 'Investigation conducted properly but insufficient evidence to make definitive determination.',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Case closure approved successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid outcome or missing case information',
    type: ApproveCaseClosureBadRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Not Found - Case or approval task not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in STATUS_22_PENDING_FINAL_APPROVAL or incomplete tasks',
    type: CaseConflictResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error - System error during approval', type: CaseErrorResponseDto })
  async approveCaseClosure(@Param('caseId') caseId: number, @Body() dto: ApproveCaseClosureDto, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId } = extractUserData(req);
    return await this.caseService.approveCaseClosure(caseId, dto.finalOutcome, dto.supervisorComments, supervisorId);
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
    description: 'Rejection details with supervisor feedback (minimum 4 characters)',
    examples: {
      example1: {
        summary: 'Incomplete investigation',
        value: {
          rejectionReason:
            'The investigation is incomplete. Please conduct additional interviews with the witnesses listed in the evidence log and provide a comprehensive timeline of events.',
        },
      },
      example2: {
        summary: 'Missing evidence',
        value: {
          rejectionReason:
            'Critical evidence is missing. The transaction logs referenced in your summary have not been uploaded. Please attach all relevant documentation before resubmitting.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case closure rejected successfully',
    type: RejectCaseClosureResponseDto,
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
  async rejectCaseClosure(@Param('caseId') caseId: number, @Body() dto: RejectCaseClosureDto, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId } = extractUserData(req);
    return await this.caseService.rejectCaseClosure(caseId, dto.rejectionReason, supervisorId);
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
    type: ApproveCaseCreationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing required fields',
    type: CaseMissingFieldsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
    type: SimpleMessageResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in PENDING_CASE_CREATION_APPROVAL state',
    type: CaseCreationConflictResponseDto,
  })
  async approveCaseCreation(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId, tenantId } = extractUserData(req);

    return await this.caseService.approveCaseCreation(caseId, supervisorId, tenantId);
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
  @ApiBody({ type: RejectCaseCreationBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Case creation rejected successfully',
    type: RejectCaseCreationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing/invalid reason or invalid case state',
    type: RejectCaseCreationBadRequestResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case or approval task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Case not in PENDING_CASE_CREATION_APPROVAL state',
    type: CaseCreationConflictResponseDto,
  })
  async rejectCaseCreation(@Param('caseId') caseId: number, @Body() body: RejectCaseCreationBodyDto, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId, tenantId } = extractUserData(req);
    return await this.caseService.rejectCaseCreation(caseId, supervisorId, tenantId, body.reason);
  }

  @Put(':caseId/approve-reopening')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve case reopening',
    description: `Supervisor approves case reopening request. Behavior depends on original requester role:
  - If ANALYST/INVESTIGATOR requested: Case assigned directly to that analyst (STATUS_10_ASSIGNED)
  - If SUPERVISOR requested OR role unclear: Case assigned to investigations queue (STATUS_02_READY_FOR_ASSIGNMENT)
 
  **Note:** The system checks for role values like 'ANALYST', 'INVESTIGATOR', 'CMS_INVESTIGATOR' (case-insensitive).
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
    type: ApproveCaseReopeningResponseDto,
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
    type: CaseReopeningConflictResponseDto,
  })
  async approveCaseReopening(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId, tenantId } = extractUserData(req);
    return await this.caseService.approveCaseReopening(caseId, supervisorId, tenantId);
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
    description: 'Rejection details including mandatory reason (minimum 4 characters)',
    examples: {
      example1: {
        summary: 'Insufficient evidence',
        value: {
          rejectionReason:
            'Insufficient new evidence to warrant reopening. The original investigation was comprehensive and all available leads were exhausted.',
        },
      },
      example2: {
        summary: 'Duplicate request',
        value: {
          rejectionReason:
            'This case reopening request is a duplicate. The same concerns were already addressed in the original investigation findings.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Case reopening rejected successfully',
    type: RejectCaseReopeningResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing or insufficient rejection reason',
    type: RejectReopeningBadRequestResponseDto,
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
  async rejectCaseReopening(@Param('caseId') caseId: number, @Body() dto: RejectCaseReopeningDto, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId, tenantId } = extractUserData(req);

    if (!dto.rejectionReason || dto.rejectionReason.trim().length < 20) {
      throw new BadRequestException('Rejection reason is required and must be at least 20 characters');
    }

    return await this.caseService.rejectCaseReopening(caseId, dto.rejectionReason, supervisorId, tenantId);
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
    type: ReturnCaseForReviewResponseDto,
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
  async returnCaseForReview(@Param('caseId') caseId: number, @Body() dto: ReturnCaseForReviewDto, @Req() req: AuthenticatedRequest) {
    const { userId: supervisorId } = extractUserData(req);
    return await this.caseService.returnCaseForReview(caseId, dto.reviewComments, supervisorId);
  }

  @Post('save-as-draft')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save case as draft',
    description: 'Investigator or Supervisor saves a case as draft from an existing alert',
  })
  @ApiBody({ type: ManualCreateCaseDto })
  @ApiResponse({
    status: 201,
    description: 'Case saved as draft successfully',
    type: ManualCaseCreatedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Missing required fields or alert already has a case' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async saveCaseAsDraft(@Body() dto: ManualCreateCaseDto, @Req() req: AuthenticatedRequest) {
    const { userId, tenantId, role } = extractUserData(req);
    return await this.caseService.saveCaseAsDraft(dto, userId, tenantId, role);
  }
}
