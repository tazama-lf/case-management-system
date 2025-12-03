import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiTags } from '@nestjs/swagger';
import { WorkqueueService } from './workqueue.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireAdminRole, RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';
import { RequestCandidateGroupDTO, TaskResponseDTO, WorkQueueStatisticsDTO } from './dto/workqueue.dto';

@ApiTags('workqueue')
@Controller('api/v1/workqueue')
@UseGuards(TazamaAuthGuard)
export class WorkqueueController {
    constructor(private readonly workqueueService: WorkqueueService) { }

    @Post('candidate-group')
    @RequireAdminRole()
    @ApiOperation({
        summary: 'Create a candidate group',
        description: 'Create a new candidate group (workqueue) in Flowable',
    })
    @ApiBody({ type: RequestCandidateGroupDTO })
    @ApiResponse({ status: 201, description: 'Candidate group created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async createCandidateGroup(@Body() body: RequestCandidateGroupDTO) {
        return this.workqueueService.createCandidateGroup(body.groupId, body.groupName, body.groupType);
    }

    @Get('candidate-group/:groupId')
    @RequireAdminRole()
    @ApiOperation({
        summary: 'Get candidate group',
        description: 'Retrieve candidate group information by ID',
    })
    @ApiParam({
        name: 'groupId',
        description: 'The group identifier',
        type: 'string',
    })
    @ApiResponse({ status: 200, description: 'Candidate group retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Candidate group not found' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getCandidateGroup(@Param('groupId') groupId: string) {
        return this.workqueueService.getCandidateGroup(groupId);
    }

    @Get('candidate-groups')
    @RequireAdminRole()
    @ApiOperation({
        summary: 'Get all candidate groups',
        description: 'Retrieve all candidate groups',
    })
    @ApiResponse({
        status: 200,
        description: 'Candidate groups retrieved successfully',
    })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    @ApiQuery({
        name: 'size',
        type: 'number',
    })
    @ApiQuery({
        name: 'start',
        type: 'number',
    })
    async getAllCandidateGroups(@Query('size') size: number, @Query('start') start: number) {
        return this.workqueueService.getAllCandidateGroups(size, start);
    }

    @Get('candidate-group/:groupId/tasks')
    @RequireAdminRole()
    @ApiOperation({
        summary: 'Get candidate group tasks',
        description: 'Retrieve all tasks assigned to a candidate group',
    })
    @ApiParam({
        name: 'groupId',
        description: 'The group identifier',
        type: 'string',
    })
    @ApiQuery({
        name: 'includeVariables',
        required: false,
        type: 'boolean',
        description: 'Whether to include task variables',
        example: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Tasks retrieved successfully',
        type: [TaskResponseDTO],
    })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getCandidateGroupTasks(@Param('groupId') groupId: string, @Query('includeVariables') includeVariables?: boolean) {
        return this.workqueueService.getCandidateGroupTasks(groupId, includeVariables ?? true);
    }

    @Get('assignee/:assignee/tasks')
    @RequireInvestigatorOrSupervisorRole()
    @ApiOperation({
        summary: 'Get tasks assigned to a user',
        description: 'Retrieve all tasks assigned to a specific user',
    })
    @ApiParam({
        name: 'assignee',
        description: 'The user identifier',
        type: 'string',
    })
    @ApiResponse({
        status: 200,
        description: 'Tasks retrieved successfully',
        type: [TaskResponseDTO],
    })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getTasksByAssignee(@Param('assignee') assignee: string) {
        return this.workqueueService.getTasksByAssignee(assignee);
    }

    @Get('statistics')
    @RequireAdminRole()
    @ApiOperation({
        summary: 'Get work queue statistics',
        description: 'Retrieve work queue statistics for all groups or a specific group',
    })
    @ApiQuery({
        name: 'groupId',
        required: false,
        type: 'string',
        description: 'Optional group identifier to filter statistics',
    })
    @ApiResponse({
        status: 200,
        description: 'Statistics retrieved successfully',
        type: WorkQueueStatisticsDTO,
    })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getWorkQueueStatistics(@Query('groupId') groupId?: string) {
        return this.workqueueService.getWorkQueueStatistics(groupId);
    }
}
