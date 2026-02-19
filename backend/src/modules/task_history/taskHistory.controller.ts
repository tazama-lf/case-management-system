import { Controller, Get, Injectable, Query, UseGuards, Param } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiTags,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { TaskHistoryService } from './taskHistory.service';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';

@ApiTags('Task History')
@Controller('api/v1/task-history')
@ApiBearerAuth('jwt')
@UseGuards(TazamaAuthGuard)
export class TaskHistoryController {
  constructor(private readonly taskHistoryService: TaskHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch task History', description: 'Returns event logs with pagination support.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of event log entries to return.',
    schema: { type: 'integer', default: 50 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of entries to skip before collecting results.',
    schema: { type: 'integer', default: 0 },
  })
  @ApiOkResponse({ description: 'Event log entries returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  async getLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return await this.taskHistoryService.getLogs(Number(limit), Number(offset));
  }

  @Get(':caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get task action history',
    description: 'Retrieve all actions taken on a specific case',
  })
  @ApiParam({
    name: 'caseId',
    type: 'string',
    description: 'UUID of the case',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Action history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action_id: { type: 'string', format: 'uuid' },
          action_type: { type: 'string' },
          user_id: { type: 'string', format: 'uuid' },
          note: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Task History not found' })
  async getCaseHistory(@Param('caseId') caseId: number) {
    return await this.taskHistoryService.getTaskHistory(caseId);
  }
}
