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
  HttpCode, HttpStatus
} from '@nestjs/common';
import { Request } from 'express';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { UnassignTaskDto } from './dto/unassign-task-dto';
import {
  RequireAlertTriageRole,
  RequireAnyValidRole,
  RequireSupervisorRole,
  RequireInvestigatorRole,
  RequireInvestigatorOrSupervisorRole,
} from '../auth/auth.decorator';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';
import { AuditLogService } from 'src/audit/auditLog.service';
import {ApiBody, ApiOperation, ApiParam, ApiResponse} from "@nestjs/swagger";

interface AuthenticatedRequest extends Request {
  user: {
    token: {
      clientId: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

@Controller('api/v1/task')
@UseGuards(TazamaAuthGuard)
export class TaskController {
  constructor(
      private readonly taskService: TaskService,
      private readonly auditLogService: AuditLogService,
      private readonly loggerService: LoggerService,
  ) {}

  @Post()
  @RequireAlertTriageRole()
  async createTask(@Body() createTaskDto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.createTask(createTaskDto, userId, this.auditLogService, this.loggerService);
  }

  @Patch(':taskId/reassign')
  @RequireAlertTriageRole()
  async reassignTask(
      @Param('taskId') taskId: string,
      @Body('assignedUserId') assignedUserId: string,
      @Req() req: AuthenticatedRequest
  ) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    return this.taskService.reassignTask(taskId, userId, tenantId, assignedUserId);
  }

  @Patch(':taskId/unassign')
  @RequireInvestigatorOrSupervisorRole()
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
          reason: 'Reassigning due to current workload constraints and priority conflicts'
        }
      },
      example2: {
        summary: 'Unassign due to expertise',
        value: {
          reason: 'Task requires specialized expertise not available with current assignee'
        }
      }
    }
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
        message: { type: 'string', example: 'User lacks required role (CMS_INVESTIGATOR) to unassign tasks in group investigations' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task does not exist',
  })
  async unassignTask(
      @Param('taskId') taskId: string,
      @Body() unassignDto: UnassignTaskDto,
      @Req() req: AuthenticatedRequest
  ) {
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
  @RequireSupervisorRole()
  async assignTaskToInvestigator(
      @Param('taskId') taskId: string,
      @Body() assignTaskDto: AssignTaskDto,
      @Req() req: AuthenticatedRequest
  ) {
    const supervisorId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;

    const result = await this.taskService.assignTaskToInvestigator(
        taskId,
        assignTaskDto.assignedUserId,
        supervisorId,
        tenantId,
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
  @RequireInvestigatorRole()
  async updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.updateTask(taskId, dto, userId, this.auditLogService);
  }

  @Get()
  @RequireAnyValidRole()
  async getTasks(@Query('status') status?: string) {
    return this.taskService.getTasks(status);
  }

  @Get('case/:caseId')
  @RequireAnyValidRole()
  async getTasksByCaseId(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.getTasksByCaseId(caseId, userId);
  }

  @Get('work-queues/:candidateGroup')
  @RequireInvestigatorOrSupervisorRole()
  async getTasksByCandidateGroup(@Param('candidateGroup') candidateGroup: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.getTasksByCandidateGroup(candidateGroup, userId);
  }

  @Get(':taskId')
  @RequireInvestigatorRole()
  async getTaskById(@Param('taskId') taskId: string) {
    return this.taskService.getTaskById(taskId);
  }
}