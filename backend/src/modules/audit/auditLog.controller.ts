import { Controller, Get, Injectable, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiOkResponse, ApiUnauthorizedResponse, ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TazamaAuthGuard } from "src/guards/tazama-auth.guard";
import { AuditLogService } from "./auditLog.service";

@ApiTags('Audit Logs')
@ApiBearerAuth('jwt')
@Controller('v1/audit-logs')
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) { }

    @UseGuards(TazamaAuthGuard)
    @Get()
    @ApiOperation({ summary: 'Fetch audit logs', description: 'Returns audit logs with pagination support.' })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Maximum number of audit log entries to return.',
        schema: { type: 'integer', default: 50 },
    })
    @ApiQuery({
        name: 'offset',
        required: false,
        description: 'Number of entries to skip before collecting results.',
        schema: { type: 'integer', default: 0 },
    })
    @ApiOkResponse({ description: 'Audit log entries returned successfully.' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
    async getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
        return this.auditLogService.getLogs(Number(limit), Number(offset));
    }
}