import { Controller, Post, Patch, Get, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireAlertTriageRole, RequireAnyValidRole } from '../auth/auth.decorator';
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
  async reassignTask(@Param('taskId') taskId: string, @Body('assignedUserId') assignedUserId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.taskService.reassignTask(taskId, userId, assignedUserId, this.auditLogService);
  }

  @Patch(':taskId/assign')
  @RequireAlertTriageRole()
  async assignTaskToInvestigator(
    @Param('taskId') taskId: string,
    @Body('assignedUserId') assignedUserId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const supervisorId = req.user.token.clientId;
    return this.taskService.assignTaskToInvestigator(taskId, assignedUserId, supervisorId, this.auditLogService);
  }

  @Patch(':taskId')
  @RequireAlertTriageRole()
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

  @Get('work-queue')
  @RequireAnyValidRole()
  async getWorkQueue(
    @Query('role') role?: string,
    @Query('candidateGroup') candidateGroup?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      role,
      candidateGroup,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.taskService.getWorkQueue(filters);
  }

  @Get(':taskId')
  @RequireAlertTriageRole()
  async getTaskById(@Param('taskId') taskId: string) {
    return this.taskService.getTaskById(taskId);
  }
}
