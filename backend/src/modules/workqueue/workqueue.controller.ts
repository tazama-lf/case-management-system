import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiTags } from '@nestjs/swagger';
import { WorkqueueService } from './workqueue.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireAdminRole, RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';

@ApiTags('workqueue')
@Controller('api/v1/workqueue')
@UseGuards(TazamaAuthGuard)
export class WorkqueueController {
  constructor(private readonly workqueueService: WorkqueueService) {}

  @Post('candidate-group')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'Create a candidate group',
    description: 'Create a new candidate group (workqueue) in Flowable',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Unique identifier for the group' },
        groupName: { type: 'string', description: 'Display name for the group' },
        groupType: { type: 'string', description: 'Type of group', default: 'candidate' },
      },
      required: ['groupId', 'groupName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Candidate group created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createCandidateGroup(@Body() body: { groupId: string; groupName: string; groupType?: string }) {
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
  @ApiResponse({
    status: 200,
    description: 'Candidate group retrieved successfully',
  })
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
  async getAllCandidateGroups() {
    return this.workqueueService.getAllCandidateGroups();
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
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          assignee: { type: 'string' },
          created: { type: 'string', format: 'date-time' },
          priority: { type: 'number' },
          variables: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCandidateGroupTasks(@Param('groupId') groupId: string, @Query('includeVariables') includeVariables?: boolean) {
    return this.workqueueService.getCandidateGroupTasks(groupId, includeVariables ?? true);
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
    schema: {
      type: 'object',
      properties: {
        totalTasks: { type: 'number' },
        assignedTasks: { type: 'number' },
        unassignedTasks: { type: 'number' },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
              taskCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getWorkQueueStatistics(@Query('groupId') groupId?: string) {
    return this.workqueueService.getWorkQueueStatistics(groupId);
  }
}
