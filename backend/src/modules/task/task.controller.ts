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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { UnassignTaskDto } from './dto/unassign-task-dto';
import {
  RequireAlertTriageRole,
  RequireAnyValidRole,
  RequireInvestigatorRole,
  RequireInvestigatorOrSupervisorRoleOrComplianceRole,
} from '../../decorators/auth.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TaskLifecycleService } from './services/task-lifecycle.service';
import { Task } from '@prisma/client-cms';
import { Audit } from '../audit/decorators/audit-log.decorator';

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
    private readonly taskLifecycleService: TaskLifecycleService,
  ) {}

  @Post()
  @RequireAlertTriageRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new task',
    description: 'Creates a new task for a case. Only users with ALERT_TRIAGE role can create tasks.',
  })
  @ApiBody({
    type: CreateTaskDto,
    description: 'Task creation details',
    examples: {
      example1: {
        summary: 'Create unassigned task',
        value: {
          caseId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Verify customer identity',
          description: 'Review submitted documents for compliance',
          candidateGroup: 'investigations',
        },
      },
      example2: {
        summary: 'Create and assign task',
        value: {
          caseId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Verify customer identity',
          description: 'Review submitted documents for compliance',
          candidateGroup: 'investigations',
          assignedUserId: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
          status: 'STATUS_10_ASSIGNED',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Task successfully created',
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
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input or case not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User lacks ALERT_TRIAGE role',
  })
  @Audit()
  async createTask(@Body() createTaskDto: CreateTaskDto, @Req() req: AuthenticatedRequest): Promise<Task> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    return await this.taskService.createTask(createTaskDto, userId, tenantId);
  }

  @Patch(':taskId/reassign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @Audit()
  @ApiOperation({
    summary: 'Reassign a task to another user',
    description:
      'Reassigns a task from one investigator to another. The target user must have the appropriate role for the task candidate group. Requires INVESTIGATOR or SUPERVISOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task to reassign',
    example: 123,
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
  async reassignTask(
    @Param('taskId') taskId: number,
    @Body() reassignTaskDto: ReassignTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Task> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;

    return await this.taskLifecycleService.reassignTask(taskId, userId, tenantId, reassignTaskDto.assignedUserId, reassignTaskDto.note);
  }

  @Patch(':taskId/unassign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unassign a task',
    description: 'Unassigns a task from its current assignee and returns it to the work queue. Requires a reason for unassignment.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task',
    example: 123,
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
  async unassignTask(
    @Param('taskId') taskId: number,
    @Body() unassignDto: UnassignTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Task> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;

    if (!userId || !tenantId) {
      throw new BadRequestException('Missing user ID or tenant ID in auth token');
    }

    if (!unassignDto.reason || unassignDto.reason.trim().length === 0) {
      throw new BadRequestException('Reason for unassigning task is required');
    }

    return await this.taskLifecycleService.unassignTask(taskId, userId, tenantId, unassignDto.reason);
  }

  @Patch(':taskId/assign')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign a task to an investigator',
    description:
      'Assigns an unassigned or previously assigned task to an investigator. Supervisors and investigators can use this endpoint.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task to assign',
    example: 123,
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
  async assignTaskToInvestigator(
    @Param('taskId') taskId: number,
    @Body() assignTaskDto: AssignTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    message: string;
    data: { taskId: number; assignedUserId: string | null; status: string; assignedAt: string };
  }> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;

    const result = await this.taskLifecycleService.assignTaskToInvestigator(
      taskId,
      assignTaskDto.assignedUserId,
      userId,
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

  @Patch(':taskId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update task details',
    description: 'Updates task information including status, name, description, and assignment. Requires INVESTIGATOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task to update',
    example: 123,
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
  async updateTask(@Param('taskId') taskId: number, @Body() dto: UpdateTaskDto, @Req() req: AuthenticatedRequest): Promise<Task> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    return await this.taskService.updateTask(taskId, dto, userId, tenantId);
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
  async getTasks(@Req() req: AuthenticatedRequest, @Query('status') status?: string): Promise<Task[]> {
    const { tenantId } = req.user.token;
    return await this.taskService.getTasks(tenantId, status);
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
    type: 'number',
    description: 'CaseId of the case',
    example: 550,
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
  async getTasksByCaseId(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<Task[]> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    const userClaims = req.user.token.claims ?? [];
    return await this.taskService.getTasksByCaseId(caseId, tenantId, userId, userClaims);
  }

  @Get(':taskId')
  @RequireInvestigatorRole()
  @ApiOperation({
    summary: 'Get task details by ID',
    description: 'Retrieves detailed information about a specific task including associated case and comments. Requires INVESTIGATOR role.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task',
    example: 123,
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
  async getTaskById(@Param('taskId') taskId: number, @Req() req: AuthenticatedRequest): Promise<Task | null> {
    const { tenantId } = req.user.token;
    return await this.taskService.getTaskById(taskId, tenantId);
  }

  @Post(':taskId/complete')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @HttpCode(HttpStatus.OK)
  @Audit()
  @ApiOperation({
    summary: 'Complete a task',
    description: 'Marks a task as completed.',
  })
  @ApiParam({
    name: 'taskId',
    type: 'number',
    description: 'CaseId of the task to update',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully completed',
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
    description: 'Forbidden - User lacks required role',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async completeTask(@Param('taskId') taskId: number, @Req() req: AuthenticatedRequest): Promise<Task> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    return await this.taskLifecycleService.completeTask(taskId, userId, tenantId);
  }
}
