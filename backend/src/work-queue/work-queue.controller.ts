import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { WorkQueueService } from './work-queue.service';
import {
  CreateWorkQueueDto,
  UpdateWorkQueueDto,
  GetWorkQueuesQueryDto,
  WorkQueueResponseDto,
  WorkQueueDetailResponseDto,
  WorkQueueListResponseDto,
  TaskFilterDto,
  CreateAssignmentRuleDto,
  UpdateAssignmentRuleDto,
  DetailedAssignmentRuleDto,
} from './dto';
import { AssignUsersDto, RemoveUsersDto, UserAssignmentResponseDto, WorkQueueMemberDto } from './dto/assign-user.dto';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { RequireInvestigatorOrSupervisorRole, RequireSupervisorRole } from '../auth/auth.decorator';

@ApiTags('Work Queue Management')
@ApiBearerAuth('jwt')
@Controller('api/v1/work-queues')
@UseGuards(TazamaAuthGuard)
@RequireInvestigatorOrSupervisorRole()
export class WorkQueueController {
  constructor(private readonly workQueueService: WorkQueueService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all work queues',
    description: 'Retrieves a paginated list of work queues with optional filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work queues retrieved successfully',
    type: WorkQueueListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async getAllWorkQueues(@Query() query: GetWorkQueuesQueryDto, @Req() req: AuthenticatedRequest): Promise<WorkQueueListResponseDto> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getAllWorkQueues(query, tenantId);
  }

  @Get(':workQueueId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get work queue details',
    description: 'Retrieves detailed information about a specific work queue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work queue retrieved successfully',
    type: WorkQueueDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Work queue not found',
  })
  async getWorkQueueById(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<WorkQueueDetailResponseDto> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getWorkQueueById(workQueueId, tenantId);
  }

  @Get('role/:roleName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get work queues by role',
    description: 'Retrieves all work queues assigned to a specific user role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work queues retrieved successfully',
    type: [WorkQueueResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async getWorkQueuesByRole(@Param('roleName') roleName: string, @Req() req: AuthenticatedRequest): Promise<WorkQueueResponseDto[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getWorkQueuesByRole(roleName, tenantId!);
  }

  @Get(':workQueueId/statistics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get work queue statistics',
    description: 'Retrieves task statistics for a specific work queue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        workQueueId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        totalTasks: { type: 'number', example: 50 },
        pendingTasks: { type: 'number', example: 15 },
        inProgressTasks: { type: 'number', example: 20 },
        completedTasks: { type: 'number', example: 12 },
        blockedTasks: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Work queue not found',
  })
  async getWorkQueueStatistics(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest) {
    const { tenantId } = req.user.token;
    return this.workQueueService.getWorkQueueStatistics(workQueueId, tenantId);
  }

  @Post()
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create work queue',
    description: 'Creates a new work queue with roles, task types, and assignment rules. Requires CMS_SUPERVISOR role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Work queue created successfully',
    type: WorkQueueDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing CMS_SUPERVISOR role',
  })
  @ApiResponse({
    status: 409,
    description: 'Work queue with this name already exists',
  })
  async createWorkQueue(@Body() createDto: CreateWorkQueueDto, @Req() req: AuthenticatedRequest): Promise<WorkQueueDetailResponseDto> {
    const { tenantId, clientId } = req.user.token;
    return this.workQueueService.createWorkQueue(createDto, tenantId!, clientId);
  }

  @Put(':workQueueId')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update work queue',
    description: 'Updates an existing work queue. All fields are optional. Requires CMS_SUPERVISOR role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work queue updated successfully',
    type: WorkQueueDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing CMS_SUPERVISOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Work queue not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Work queue name already exists',
  })
  async updateWorkQueue(
    @Param('workQueueId') workQueueId: string,
    @Body() updateDto: UpdateWorkQueueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkQueueDetailResponseDto> {
    const { tenantId, clientId } = req.user.token;
    return this.workQueueService.updateWorkQueue(workQueueId, updateDto, tenantId!, clientId);
  }

  @Put(':workQueueId/deactivate')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate work queue',
    description: 'Soft-deletes a work queue by setting isActive to false. Requires CMS_SUPERVISOR role.',
  })
  @ApiResponse({
    status: 204,
    description: 'Work queue deactivated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing CMS_SUPERVISOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Work queue not found',
  })
  async deactivateWorkQueue(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<void> {
    const { tenantId, clientId } = req.user.token;
    await this.workQueueService.deactivateWorkQueue(workQueueId, tenantId!, clientId);
  }

  @Delete(':workQueueId')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete work queue',
    description: 'Permanently deletes a work queue. Use reassignQueueId query param to reassign tasks. Requires CMS_SUPERVISOR role.',
  })
  @ApiResponse({
    status: 204,
    description: 'Work queue deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete queue with active tasks without reassignment',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing CMS_SUPERVISOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Work queue not found',
  })
  async deleteWorkQueue(
    @Param('workQueueId') workQueueId: string,
    @Query('reassignQueueId') reassignQueueId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const { tenantId, clientId } = req.user.token;
    await this.workQueueService.deleteWorkQueue(workQueueId, tenantId!, clientId, reassignQueueId);
  }

  @Post(':workQueueId/members')
  @RequireSupervisorRole()
  @ApiOperation({
    summary: 'Assign users to a work queue',
    description:
      'Assigns one or more users to a work queue. Assignment can be manual (by admin) or automatic (role-based). OVERRIDE type allows admins to lock assignments that should not change with role updates.',
  })
  @ApiBody({ type: AssignUsersDto })
  @ApiResponse({
    status: 201,
    description: 'Users successfully assigned to work queue.',
    type: [UserAssignmentResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid request data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async assignUsers(
    @Param('workQueueId') workQueueId: string,
    @Body() dto: AssignUsersDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserAssignmentResponseDto[]> {
    const { tenantId, clientId } = req.user.token;
    return this.workQueueService.assignUsers(workQueueId, dto.userIds, tenantId!, clientId, dto.assignmentType);
  }

  @Delete(':workQueueId/members')
  @RequireSupervisorRole()
  @ApiOperation({
    summary: 'Remove users from a work queue',
    description: 'Removes one or more users from a work queue. This action is logged in the audit trail.',
  })
  @ApiBody({ type: RemoveUsersDto })
  @ApiResponse({
    status: 200,
    description: 'Users successfully removed from work queue.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Successfully removed 2 user(s) from work queue' },
        removedCount: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async removeUsers(
    @Param('workQueueId') workQueueId: string,
    @Body() dto: RemoveUsersDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string; removedCount: number }> {
    const { tenantId, clientId } = req.user.token;
    const removedCount = await this.workQueueService.removeUsers(workQueueId, dto.userIds, tenantId!, clientId);
    return {
      message: `Successfully removed ${removedCount} user(s) from work queue`,
      removedCount,
    };
  }

  @Get(':workQueueId/members')
  @ApiOperation({
    summary: 'List all users assigned to a work queue',
    description: 'Retrieves all users currently assigned to the specified work queue, including their assignment type and metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of work queue members retrieved successfully.',
    type: [WorkQueueMemberDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getWorkQueueMembers(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<WorkQueueMemberDto[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getWorkQueueMembers(workQueueId, tenantId!);
  }

  @Get('users/:userId/assignments')
  @ApiOperation({
    summary: 'Get all work queues a user is assigned to',
    description: 'Retrieves all work queues that the specified user is assigned to, including assignment details and queue information.',
  })
  @ApiResponse({
    status: 200,
    description: 'User\'s work queue assignments retrieved successfully.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          workQueueId: { type: 'string', format: 'uuid' },
          workQueueName: { type: 'string', example: 'High Priority Queue' },
          assignmentType: { type: 'string', enum: ['MANUAL', 'AUTOMATIC', 'OVERRIDE'] },
          assignedAt: { type: 'string', format: 'date-time' },
          taskCount: { type: 'number', example: 5 },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 404, description: 'User not found or no assignments.' })
  async getUserWorkQueueAssignments(@Param('userId') userId: string, @Req() req: AuthenticatedRequest): Promise<any[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getUserWorkQueueAssignments(userId, tenantId!);
  }

  @Get('dashboard/supervisor')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get supervisor dashboard with aggregated metrics',
    description:
      'Retrieves comprehensive dashboard metrics across all work queues assigned to the supervisor, including task counts, SLA metrics, and performance indicators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Supervisor dashboard retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        supervisorId: { type: 'string', format: 'uuid' },
        totalWorkQueues: { type: 'number', example: 3 },
        totalTasks: { type: 'number', example: 150 },
        totalActiveTasks: { type: 'number', example: 105 },
        aggregatedTaskCounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED', 'STATUS_21_BLOCKED'],
              },
              count: { type: 'number' },
            },
          },
        },
        aggregatedSLAMetrics: {
          type: 'object',
          properties: {
            overdueCount: { type: 'number' },
            breachCount: { type: 'number' },
            atRiskCount: { type: 'number' },
            onTrackCount: { type: 'number' },
            avgCompletionTime: { type: 'number' },
            complianceRate: { type: 'number' },
          },
        },
        workQueueMetrics: { type: 'array' },
        totalAssignedUsers: { type: 'number' },
        generatedAt: { type: 'string', format: 'date-time' },
        refreshInterval: { type: 'number', example: 60 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  async getSupervisorDashboard(@Req() req: AuthenticatedRequest): Promise<any> {
    const { clientId: userId, tenantId } = req.user.token;
    return this.workQueueService.getSupervisorDashboard(userId, tenantId!);
  }

  @Get(':workQueueId/metrics')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get work queue metrics',
    description:
      'Retrieves detailed metrics for a specific work queue, including task counts by status, SLA metrics, and performance indicators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work queue metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        workQueueId: { type: 'string', format: 'uuid' },
        workQueueName: { type: 'string' },
        totalTasks: { type: 'number' },
        activeTasks: { type: 'number' },
        taskCountsByStatus: { type: 'array' },
        slaMetrics: { type: 'object' },
        assignedUserCount: { type: 'number' },
        calculatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getWorkQueueMetrics(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<any> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getWorkQueueMetrics(workQueueId, tenantId!);
  }

  @Get(':workQueueId/tasks')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filtered tasks for a work queue',
    description:
      'Retrieves a paginated and filtered list of tasks for a specific work queue. Supports filtering by user, priority, status, SLA status, and date ranges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered tasks retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        tasks: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getTasksByWorkQueue(
    @Param('workQueueId') workQueueId: string,
    @Query() filters: TaskFilterDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getTasksByWorkQueue(workQueueId, filters, tenantId!);
  }

  @Get(':workQueueId/overdue')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get overdue tasks for a work queue',
    description: 'Retrieves all tasks that are past their SLA deadline for a specific work queue, sorted by most overdue first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overdue tasks retrieved successfully',
    type: [Object],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getOverdueTasks(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<any[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getOverdueTasks(workQueueId, tenantId!);
  }

  @Get(':workQueueId/sla-breaches')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get SLA breach tasks for a work queue',
    description: 'Retrieves all tasks with SLA breaches for a specific work queue, including breach severity classification.',
  })
  @ApiResponse({
    status: 200,
    description: 'SLA breach tasks retrieved successfully',
    type: [Object],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getSLABreachTasks(@Param('workQueueId') workQueueId: string, @Req() req: AuthenticatedRequest): Promise<any[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getSLABreachTasks(workQueueId, tenantId!);
  }

  // ========== Assignment Rule Management Endpoints ==========
  // DISABLED
  // Auto-assignment rules are not part of MVP and have no frontend implementation.
  // These endpoints are commented out but kept for future use.
  // To re-enable: Uncomment these endpoints and the auto-assignment logic in task.service.ts

  /*
  @Post(':workQueueId/rules')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create assignment rule',
    description: 'Creates a new automated task assignment rule for a work queue.',
  })
  @ApiBody({ type: CreateAssignmentRuleDto })
  @ApiResponse({
    status: 201,
    description: 'Assignment rule created successfully',
    type: DetailedAssignmentRuleDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid rule configuration or validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  @ApiResponse({ status: 409, description: 'Conflict - Rule conflicts with existing rules.' })
  async createAssignmentRule(
    @Param('workQueueId') workQueueId: string,
    @Body() dto: CreateAssignmentRuleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto> {
    const { clientId, tenantId } = req.user.token;
    return this.workQueueService.createAssignmentRule(workQueueId, dto, clientId, tenantId!);
  }

  @Get(':workQueueId/rules')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List assignment rules',
    description: 'Retrieves all assignment rules for a work queue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment rules retrieved successfully',
    type: [DetailedAssignmentRuleDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue not found.' })
  async getAssignmentRules(
    @Param('workQueueId') workQueueId: string,
    @Query('activeOnly') activeOnly: boolean,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto[]> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getAssignmentRules(workQueueId, tenantId!, activeOnly);
  }

  @Get(':workQueueId/rules/:ruleId')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get assignment rule details',
    description: 'Retrieves detailed information about a specific assignment rule.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment rule retrieved successfully',
    type: DetailedAssignmentRuleDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue or assignment rule not found.' })
  async getAssignmentRuleById(
    @Param('workQueueId') workQueueId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto> {
    const { tenantId } = req.user.token;
    return this.workQueueService.getAssignmentRuleById(workQueueId, ruleId, tenantId!);
  }

  @Put(':workQueueId/rules/:ruleId')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update assignment rule',
    description: 'Updates an existing assignment rule.',
  })
  @ApiBody({ type: UpdateAssignmentRuleDto })
  @ApiResponse({
    status: 200,
    description: 'Assignment rule updated successfully',
    type: DetailedAssignmentRuleDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid rule configuration or validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue or assignment rule not found.' })
  async updateAssignmentRule(
    @Param('workQueueId') workQueueId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAssignmentRuleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto> {
    const { clientId, tenantId } = req.user.token;
    return this.workQueueService.updateAssignmentRule(workQueueId, ruleId, dto, clientId, tenantId!);
  }

  @Delete(':workQueueId/rules/:ruleId')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete assignment rule',
    description: 'Deletes an assignment rule from a work queue.',
  })
  @ApiResponse({ status: 204, description: 'Assignment rule deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue or assignment rule not found.' })
  async deleteAssignmentRule(
    @Param('workQueueId') workQueueId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const { clientId, tenantId } = req.user.token;
    return this.workQueueService.deleteAssignmentRule(workQueueId, ruleId, clientId, tenantId!);
  }

  @Post(':workQueueId/rules/:ruleId/activate')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate assignment rule',
    description: 'Activates a previously deactivated assignment rule.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment rule activated successfully',
    type: DetailedAssignmentRuleDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue or assignment rule not found.' })
  async activateRule(
    @Param('workQueueId') workQueueId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto> {
    const { clientId, tenantId } = req.user.token;
    return this.workQueueService.activateRule(workQueueId, ruleId, clientId, tenantId!);
  }

  @Post(':workQueueId/rules/:ruleId/deactivate')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate assignment rule',
    description: 'Deactivates an active assignment rule.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment rule deactivated successfully',
    type: DetailedAssignmentRuleDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have CMS_SUPERVISOR role.' })
  @ApiResponse({ status: 404, description: 'Work queue or assignment rule not found.' })
  async deactivateRule(
    @Param('workQueueId') workQueueId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DetailedAssignmentRuleDto> {
    const { clientId, tenantId } = req.user.token;
    return this.workQueueService.deactivateRule(workQueueId, ruleId, clientId, tenantId!);
  }
  */
}
