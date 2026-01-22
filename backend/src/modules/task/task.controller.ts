import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TaskService } from './task.service';
import { CreateTaskDto } from '../../dtos/CreateTask.dto';
import { UpdateTaskDto } from './dto/UpdateTask.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { UnassignTaskDto } from './dto/unassign-task-dto';
import {
  RequireAnyValidRole,
  RequireSupervisorRole,
  RequireInvestigatorRole,
  RequireInvestigatorOrSupervisorRoleOrComplianceRole,
} from '../../decorators/auth.decorator';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: {
    token: {
      clientId: string;
      tenantId: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

@Controller('api/v1/task')
@UseGuards(TazamaAuthGuard)
@ApiTags('Tasks')
@ApiBearerAuth('jwt')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly auditLogService: AuditLogService,
    private readonly loggerService: LoggerService,
    private readonly flowableService: FlowableService,
  ) {}

  @Patch(':taskId/reassign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reassign a task to another user',
    description:
      'Reassigns a task from one investigator to another. The target user must have the appropriate role for the task candidate group. Requires INVESTIGATOR or SUPERVISOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to reassign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ReassignTaskDto,
    description: 'Reassignment details',
    examples: {
      example1: {
        summary: 'Reassign to another investigator',
        value: {
          assignedUserId: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully reassigned',
    schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', format: 'uuid' },
        case_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'STATUS_10_ASSIGNED' },
        assigned_user_id: { type: 'string', format: 'uuid' },
        candidateGroup: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Task not found, completed, user invalid, or lacks required role',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User or target lacks required role',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async reassignTask(@Param('taskId') taskId: number, @Body() reassignTaskDto: ReassignTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    return this.taskService.reassignTask(taskId, userId, tenantId, reassignTaskDto.assignedUserId, reassignTaskDto.note);
  }

  @Patch(':taskId/unassign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unassign a task',
    description: 'Unassigns a task from its current assignee and returns it to the work queue. Requires a reason for unassignment.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to unassign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UnassignTaskDto,
    description: 'Unassignment details including mandatory reason',
    examples: {
      example1: {
        summary: 'Unassign due to workload',
        value: {
          reason: 'Reassigning due to current workload constraints and priority conflicts',
        },
      },
      example2: {
        summary: 'Unassign due to expertise',
        value: {
          reason: 'Task requires specialized expertise not available with current assignee',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully unassigned',
    schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', format: 'uuid' },
        case_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'STATUS_01_UNASSIGNED' },
        assigned_user_id: { type: 'null' },
        candidateGroup: { type: 'string', example: 'investigations' },
        message: { type: 'string' },
        unassignmentReason: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Task already unassigned, task completed, or missing reason',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Task is already unassigned' },
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
    description: 'Forbidden - User lacks required role to unassign tasks in this candidate group',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async unassignTask(@Param('taskId') taskId: number, @Body() unassignDto: UnassignTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    if (!userId || !tenantId) {
      throw new BadRequestException('Missing user ID or tenant ID in auth token');
    }

    if (!unassignDto.reason || unassignDto.reason.trim().length === 0) {
      throw new BadRequestException('Reason for unassigning task is required');
    }

    return this.taskService.unassignTask(taskId, userId, tenantId, unassignDto.reason);
  }

  @Patch(':taskId/assign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign a task to an investigator',
    description:
      'Assigns an unassigned or previously assigned task to an investigator. Supervisors and investigators can use this endpoint.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to assign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AssignTaskDto,
    description: 'Assignment details',
    examples: {
      example1: {
        summary: 'Assign to investigator',
        value: {
          assignedUserId: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
          comments: 'Assign to experienced investigator for priority handling',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully assigned',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
            assignedUserId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            assignedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Task not found or investigator lacks required role',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR or SUPERVISOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task or investigator does not exist',
  })
  async assignTaskToInvestigator(@Param('taskId') taskId: number, @Body() assignTaskDto: AssignTaskDto, @Req() req: AuthenticatedRequest) {
    const supervisorId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    const result = await this.taskService.assignTaskToInvestigator(
      taskId,
      assignTaskDto.assignedUserId,
      supervisorId,
      tenantId,
      assignTaskDto.note,
    );

    return {
      success: true,
      message: `Task ${taskId} successfully assigned to investigator ${assignTaskDto.assignedUserId}`,
      data: {
        taskId: result.task_id,
        assignedUserId: result.assigned_user_id,
        status: result.status,
        assignedAt: new Date().toISOString(),
      },
    };
  }

  @Patch(':taskId/self-assign')
  @RequireInvestigatorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Self-assign a task (Investigator)',
    description: 'Allows an investigator to assign an unassigned task to themselves. Only works on unassigned tasks.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to self-assign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully self-assigned',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
            assignedUserId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            assignedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Task is already assigned',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async selfAssignTask(@Param('taskId') taskId: number, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    const result = await this.taskService.selfAssignTask(taskId, userId, tenantId);

    return {
      success: true,
      message: `Task ${taskId} successfully self-assigned`,
      data: {
        taskId: result.task_id,
        assignedUserId: result.assigned_user_id,
        status: result.status,
        assignedAt: new Date().toISOString(),
      },
    };
  }

  @Patch(':taskId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update task details',
    description: 'Updates task information including status, name, description, and assignment. Requires INVESTIGATOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateTaskDto,
    description: 'Task update details (all fields optional)',
    examples: {
      example1: {
        summary: 'Update status to in-progress',
        value: {
          status: 'STATUS_20_IN_PROGRESS',
        },
      },
      example2: {
        summary: 'Update description',
        value: {
          description: 'Updated findings from initial review',
        },
      },
      example3: {
        summary: 'Complete task',
        value: {
          status: 'STATUS_30_COMPLETED',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully updated',
    schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', format: 'uuid' },
        case_id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        assigned_user_id: { type: 'string', format: 'uuid', nullable: true },
        candidateGroup: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid status or task data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async updateTask(@Param('taskId') taskId: number, @Body() dto: UpdateTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.updateTask(taskId, dto, userId);
  }

  @Get()
  @RequireAnyValidRole()
  @ApiOperation({
    summary: 'Get all tasks with optional filtering',
    description: 'Retrieves all tasks, optionally filtered by status. Any authenticated user can access this endpoint.',
  })
  @ApiQuery({
    name: 'status',
    type: 'string',
    description: 'Filter by task status',
    enum: ['STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED'],
    required: false,
    example: 'STATUS_01_UNASSIGNED',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tasks',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task_id: { type: 'string', format: 'uuid' },
          case_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          candidateGroup: { type: 'string' },
          assigned_user_id: { type: 'string', format: 'uuid', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          case: {
            type: 'object',
            properties: {
              case_id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              priority: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  async getTasks(@Query('status') status?: string) {
    return this.taskService.getTasks(status);
  }

  @Get('case/:caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get tasks for a specific case',
    description:
      'Retrieves all tasks associated with a given case ID. Compliance queue tasks are only visible to users with CMS_COMPLIANCE_OFFICER role.',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tasks for the case',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task_id: { type: 'string', format: 'uuid' },
          case_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          assigned_user_id: { type: 'string', format: 'uuid', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          case: {
            type: 'object',
            properties: {
              case_id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              priority: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Case does not exist',
  })
  async getTasksByCaseId(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const userClaims = req.user.token.claims || [];
    return this.taskService.getTasksByCaseId(caseId, userId, userClaims);
  }

  @Get('work-queues/:candidateGroup')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get work queue for a candidate group',
    description:
      'Retrieves active tasks for a specific candidate group from Flowable. Since Flowable and domain tables are in sync, candidate groups are better managed in Flowable for consistent workflow management.',
  })
  @ApiParam({
    name: 'candidateGroup',
    type: 'string',
    description: 'Candidate group identifier',
    example: 'investigations',
    enum: ['supervisors', 'investigations', 'analysts'],
  })
  @ApiQuery({
    name: 'unassignedOnly',
    required: false,
    type: Boolean,
    description: 'Filter for unassigned tasks only',
    example: false,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'List of tasks in the work queue from Flowable',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  assignee: { type: 'string', nullable: true },
                  candidateGroups: { type: 'array', items: { type: 'string' } },
                  created: { type: 'string', format: 'date-time' },
                  processInstanceId: { type: 'string' },
                  taskDefinitionKey: { type: 'string' },
                },
              },
            },
            total: { type: 'number', example: 50 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR or SUPERVISOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Invalid candidate group',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - Flowable service unavailable, falling back to domain tables',
  })
  async getTasksByCandidateGroup(
    @Param('candidateGroup') candidateGroup: string,
    @Req() req: AuthenticatedRequest,
    @Query('unassignedOnly') unassignedOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user.token.clientId;
      const tenantId = req.user.token.tenantId;
      const userClaims = req.user.token.backendClaims || [];

      if (!userId) {
        throw new BadRequestException('User not authenticated or missing client ID');
      }

      // Check if user is investigator (not supervisor or admin)
      const isInvestigator =
        userClaims.includes('CMS_INVESTIGATOR') && !userClaims.includes('CMS_SUPERVISOR') && !userClaims.includes('CMS_ADMIN');

      // Restrict investigators to only see investigations and investigators queues
      const allowedQueues = ['investigations', 'investigators'];
      if (isInvestigator && !allowedQueues.includes(candidateGroup)) {
        throw new ForbiddenException('Investigators can only access the investigations and investigators queues');
      }

      const pageNum = parseInt(page || '1');
      const limitNum = parseInt(limit || '20');

      try {
        const flowableTasks = await this.flowableService.getCandidateGroupTasks(candidateGroup, true);

        let filteredTasks = flowableTasks;
        if (unassignedOnly === 'true') {
          filteredTasks = flowableTasks.filter((task: any) => !task.assignee);
        }

        const startIndex = (pageNum - 1) * limitNum;
        const paginatedTasks = filteredTasks.slice(startIndex, startIndex + limitNum);

        return {
          success: true,
          data: {
            tasks: paginatedTasks,
            total: filteredTasks.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(filteredTasks.length / limitNum),
          },
          source: 'flowable',
        };
      } catch (flowableError) {
        this.loggerService.warn(
          `Flowable service unavailable for candidate group ${candidateGroup}, falling back to domain tables: ${flowableError.message}`,
          TaskController.name,
        );

        const domainTasks = await this.taskService.getTasksByCandidateGroup(candidateGroup, userId);

        let filteredTasks = domainTasks;
        if (unassignedOnly === 'true') {
          filteredTasks = domainTasks.filter((t: any) => !t.assigned_user_id);
        }

        const startIndex = (pageNum - 1) * limitNum;
        const paginatedTasks = filteredTasks.slice(startIndex, startIndex + limitNum);

        return {
          success: true,
          data: {
            tasks: paginatedTasks,
            total: filteredTasks.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(filteredTasks.length / limitNum),
          },
          source: 'domain_tables',
          warning: 'Flowable service unavailable, using domain tables as fallback',
        };
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to get tasks for candidate group ${candidateGroup}: ${error.message}`,
        error.stack,
        TaskController.name,
      );
      throw error;
    }
  }

  @Get(':taskId')
  @RequireInvestigatorRole()
  @ApiOperation({
    summary: 'Get task details by ID',
    description: 'Retrieves detailed information about a specific task including associated case and comments. Requires INVESTIGATOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Task details',
    schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', format: 'uuid' },
        case_id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        candidateGroup: { type: 'string' },
        assigned_user_id: { type: 'string', format: 'uuid', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        case: {
          type: 'object',
          properties: {
            case_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            priority: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        comments: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async getTaskById(@Param('taskId') taskId: number) {
    return this.taskService.getTaskById(taskId);
  }

  @Post(':taskId/reassign-queue')
  @RequireSupervisorRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reassign task to a different work queue',
    description:
      'Reassigns a task from its current work queue to a target work queue. Only supervisors can perform cross-queue reassignment. The task cannot be reassigned if it is currently in progress (claimed by an investigator). The reassignment is logged in the audit trail and notifications are sent to both queues.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'string',
    description: 'UUID of the task to reassign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ReassignTaskDto,
    description: 'Work queue reassignment details including target queue, optional reason, and optional immediate assignment',
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully reassigned to target work queue.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Task is in progress, already in target queue, or invalid data.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CMS_SUPERVISOR role or task belongs to different tenant.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task or target work queue not found.',
  })
  async reassignTaskToWorkQueue(@Param('taskId') taskId: number, @Body() dto: ReassignTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    if (!dto.targetWorkQueueId) {
      throw new BadRequestException('targetWorkQueueId is required');
    }

    return this.taskService.reassignTaskToWorkQueue(taskId, dto.targetWorkQueueId, userId, tenantId, dto.reason, dto.assignedUserId);
  }

  @Get('statistics')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get work queue statistics',
    description: 'Retrieves task statistics for work queues accessible to the authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Work queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            totalTasks: { type: 'number', example: 50 },
            pendingTasks: { type: 'number', example: 15 },
            inProgressTasks: { type: 'number', example: 20 },
            completedTasks: { type: 'number', example: 12 },
            unassignedTasks: { type: 'number', example: 8 },
            overdueTasks: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks INVESTIGATOR or SUPERVISOR role',
  })
  async getWorkQueueStatistics(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.token.clientId;
      const statistics = await this.taskService.getWorkQueueStatistics(userId);
      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      this.loggerService.error(`Failed to get work queue statistics: ${error.message}`, error.stack, TaskController.name);
      throw error;
    }
  }
}
