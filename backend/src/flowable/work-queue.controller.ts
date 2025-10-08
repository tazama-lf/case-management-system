import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { TaskService } from '../task/task.service';
import { FlowableService } from './flowable.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireAnyValidRole, RequireSupervisorRole, RequireInvestigatorRole, RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

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

interface GroupResult {
    group: string;
    status: string;
    error?: any;
}

@ApiTags('Work Queues')
@Controller('api/v1/work-queues')
@UseGuards(TazamaAuthGuard)
export class WorkQueueController {
    constructor(
        private readonly taskService: TaskService,
        private readonly flowableService: FlowableService,
        private readonly logger: LoggerService,
    ) {}

    /**
     * Get all available work queues (candidate groups)
     */
    @Get('groups')
    @RequireAnyValidRole()
    @ApiOperation({ summary: 'Get all available candidate groups' })
    @ApiResponse({ status: HttpStatus.OK, description: 'List of candidate groups retrieved successfully' })
    async getCandidateGroups() {
        try {
            const groups = await this.flowableService.getAllCandidateGroups();
            return {
                success: true,
                data: groups,
            };
        } catch (error) {
            this.logger.error(`Failed to get candidate groups: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Get('statistics')
    @RequireInvestigatorOrSupervisorRole()
    @ApiOperation({ summary: 'Get work queue statistics' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Work queue statistics retrieved successfully' })
    async getWorkQueueStatistics(@Req() req: AuthenticatedRequest) {
        try {
            const userId = req.user.token.clientId;
            const statistics = await this.taskService.getWorkQueueStatistics(userId);
            return {
                success: true,
                data: statistics,
            };
        } catch (error) {
            this.logger.error(`Failed to get work queue statistics: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Get(':candidateGroup/tasks')
    @RequireAnyValidRole()
    @ApiOperation({ summary: 'Get tasks for a specific candidate group' })
    @ApiParam({ name: 'candidateGroup', description: 'The candidate group name (e.g., Supervisors, Investigations, Analysts)' })
    @ApiQuery({ name: 'unassignedOnly', required: false, type: Boolean, description: 'Filter for unassigned tasks only' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully' })
    async getTasksForCandidateGroup(
        @Param('candidateGroup') candidateGroup: string,
        @Query('unassignedOnly') unassignedOnly?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Req() req?: AuthenticatedRequest,
    ) {
        try {
            const userId = req?.user?.token?.clientId;
            if (!userId) {
                throw new Error('User not authenticated or missing client ID');
            }
            const tasks = await this.taskService.getTasksByCandidateGroup(candidateGroup, userId);

            // Apply additional filtering if requested
            let filteredTasks = tasks;
            if (unassignedOnly === 'true') {
                filteredTasks = tasks.filter((t: any) => !t.assignee);
            }

            // Apply pagination
            const pageNum = parseInt(page || '1');
            const limitNum = parseInt(limit || '20');
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
            };
        } catch (error) {
            this.logger.error(`Failed to get tasks for candidate group ${candidateGroup}: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Get('my-tasks')
    @RequireAnyValidRole()
    @ApiOperation({ summary: 'Get tasks assigned to the current user' })
    @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks' })
    @ApiResponse({ status: HttpStatus.OK, description: 'User tasks retrieved successfully' })
    async getMyTasks(
        @Req() req: AuthenticatedRequest,
        @Query('includeCompleted') includeCompleted?: string,
    ) {
        try {
            const userId = req.user.token.clientId;
            const tasks = await this.flowableService.getUserTasks(userId, true);

            // Filter out completed tasks unless requested
            let filteredTasks = tasks;
            if (includeCompleted !== 'true') {
                filteredTasks = tasks.filter((t: any) => {
                    const status = t.variables?.task_status;
                    return status !== 'STATUS_30_COMPLETED';
                });
            }

            return {
                success: true,
                data: filteredTasks,
            };
        } catch (error) {
            this.logger.error(`Failed to get user tasks: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Post('tasks/:taskId/claim')
    @RequireInvestigatorRole()
    @ApiOperation({ summary: 'Claim a task from a work queue' })
    @ApiParam({ name: 'taskId', description: 'The Flowable task ID to claim' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Task claimed successfully' })
    async claimTask(
        @Param('taskId') taskId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        try {
            const userId = req.user.token.clientId;
            await this.flowableService.claimTask(taskId, userId);

            // Update database task if it exists
            const task = await this.flowableService.getTask(taskId);
            if (task?.variables?.postgres_task_id) {
                await this.taskService.updateTask(
                    task.variables.postgres_task_id,
                    { assignedUserId: userId, status: 'STATUS_10_ASSIGNED' },
                    userId,
                    null, // audit service will be handled in taskService
                );
            }

            return {
                success: true,
                message: `Task ${taskId} claimed successfully`,
            };
        } catch (error) {
            this.logger.error(`Failed to claim task ${taskId}: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Post('tasks/:taskId/release')
    @RequireInvestigatorRole()
    @ApiOperation({ summary: 'Release a task back to the work queue' })
    @ApiParam({ name: 'taskId', description: 'The Flowable task ID to release' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Task released successfully' })
    async releaseTask(
        @Param('taskId') taskId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        try {
            const userId = req.user.token.clientId;
            await this.flowableService.unclaimTask(taskId);

            // Update database task if it exists
            const task = await this.flowableService.getTask(taskId);
            if (task?.variables?.postgres_task_id) {
                await this.taskService.updateTask(
                    task.variables.postgres_task_id,
                    { assignedUserId: undefined, status: 'STATUS_01_UNASSIGNED' },
                    userId,
                    null,
                );
            }

            return {
                success: true,
                message: `Task ${taskId} released successfully`,
            };
        } catch (error) {
            this.logger.error(`Failed to release task ${taskId}: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Post('tasks/:taskId/delegate')
    @RequireSupervisorRole()
    @ApiOperation({ summary: 'Delegate a task to another user' })
    @ApiParam({ name: 'taskId', description: 'The Flowable task ID to delegate' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Task delegated successfully' })
    async delegateTask(
        @Param('taskId') taskId: string,
        @Body('userId') delegateToUserId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        try {
            const supervisorId = req.user.token.clientId;
            const tenantId = req.user.token.tenantId;
            await this.flowableService.delegateTask(taskId, delegateToUserId);

            // Update database task if it exists
            const task = await this.flowableService.getTask(taskId);
            if (task?.variables?.postgres_task_id) {
                await this.taskService.assignTaskToInvestigator(
                    task.variables.postgres_task_id,
                    delegateToUserId,
                    supervisorId,
                    tenantId
                );
            }

            return {
                success: true,
                message: `Task ${taskId} delegated to user ${delegateToUserId}`,
            };
        } catch (error) {
            this.logger.error(`Failed to delegate task ${taskId}: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Get()
    @RequireInvestigatorOrSupervisorRole()
    @ApiOperation({ summary: 'Get comprehensive work queue view' })
    @ApiQuery({ name: 'candidateGroup', required: false, description: 'Filter by candidate group' })
    @ApiQuery({ name: 'unassignedOnly', required: false, type: Boolean })
    @ApiQuery({ name: 'assignedToMe', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: HttpStatus.OK, description: 'Work queue retrieved successfully' })
    async getWorkQueue(
        @Query('candidateGroup') candidateGroup?: string,
        @Query('unassignedOnly') unassignedOnly?: string,
        @Query('assignedToMe') assignedToMe?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Req() req?: AuthenticatedRequest,
    ) {
        try {
            const userId = req?.user?.token?.clientId;
            if (!userId) {
                throw new Error('User not authenticated or missing client ID');
            }

            const filters = {
                candidateGroup,
                unassignedOnly: unassignedOnly === 'true',
                assignedToMe: assignedToMe === 'true' ? userId : undefined,
                page: parseInt(page || '1'),
                limit: parseInt(limit || '20'),
            };

            const result = await this.taskService.getWorkQueue(filters);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error(`Failed to get work queue: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Post('initialize')
    @RequireSupervisorRole()
    @ApiOperation({ summary: 'Initialize candidate groups in Flowable' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Candidate groups initialized successfully' })
    async initializeCandidateGroups(@Req() req: AuthenticatedRequest) {
        try {
            const userId = req.user.token.clientId;

            // Create default candidate groups
            const groups = [
                { id: 'supervisors', name: 'Supervisors', type: 'candidate' },
                { id: 'investigations', name: 'Investigations', type: 'candidate' },
                { id: 'analysts', name: 'Analysts', type: 'candidate' },
            ];

            const results: GroupResult[] = [];
            for (const group of groups) {
                try {
                    const result = await this.flowableService.createGroup(group);
                    results.push({ group: group.name, status: result ? 'created' : 'already exists' });
                } catch (error) {
                    results.push({ group: group.name, status: 'failed', error: error.message });
                }
            }

            this.logger.log(`Candidate groups initialized by ${userId}`, WorkQueueController.name);

            return {
                success: true,
                data: results,
            };
        } catch (error) {
            this.logger.error(`Failed to initialize candidate groups: ${error.message}`, error.stack, WorkQueueController.name);
            throw error;
        }
    }

    @Get('health')
    @RequireAnyValidRole()
    @ApiOperation({ summary: 'Check Flowable service health' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Health check completed' })
    async healthCheck() {
        try {
            const health = await this.flowableService.healthCheck();
            return {
                success: health.status === 'healthy',
                ...health,
            };
        } catch (error) {
            this.logger.error(`Health check failed: ${error.message}`, error.stack, WorkQueueController.name);
            return {
                success: false,
                status: 'unhealthy',
                message: error.message,
            };
        }
    }
}