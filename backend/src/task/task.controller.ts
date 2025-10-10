import { Controller, Post, Patch, Get, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
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
  @RequireAlertTriageRole()
  async unassignTask(
      @Param('taskId') taskId: string,
      @Body() unassignDto: UnassignTaskDto,
      @Req() req: AuthenticatedRequest
  ) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
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
