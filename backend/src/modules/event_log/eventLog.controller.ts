import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiOkResponse, ApiUnauthorizedResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { EventLogService } from './eventLog.service';
import { EventLog } from '@prisma/client-cms';

@ApiTags('Event Logs')
@ApiBearerAuth('jwt')
@Controller('v1/event-logs')
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  @UseGuards(TazamaAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Fetch event logs', description: 'Returns event logs with pagination support.' })
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
  async getEventLogs(@Query('limit') limit = 50, @Query('offset') offset = 0): Promise<EventLog[]> {
    return await this.eventLogService.getLogs(limit, offset);
  }
}
