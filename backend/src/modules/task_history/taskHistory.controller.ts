import { Controller, Get, Query, UseGuards, Param, Req, ParseIntPipe } from '@nestjs/common';
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
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { TaskHistory } from '@prisma/client-cms';

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
  async getLogs(
    @Query('limit', ParseIntPipe) limit = 50,
    @Query('offset', ParseIntPipe) offset = 0,
    @Req() req: AuthenticatedRequest,
  ): Promise<TaskHistory[]> {
    const {
      user: {
        token: { tenantId },
      },
    } = req;
    return await this.taskHistoryService.getLogs(tenantId, limit, offset);
  }

  @Get(':caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get task action history',
    description: 'Retrieve all actions taken on a specific case',
  })
  @ApiParam({
    name: 'caseId',
    type: 'number',
    description: 'case Id',
    example: '123',
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
  async getCaseHistory(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<TaskHistory[]> {
    const {
      user: {
        token: { tenantId },
      },
    } = req;
    return await this.taskHistoryService.getTaskHistory(caseId, tenantId);
  }
}
