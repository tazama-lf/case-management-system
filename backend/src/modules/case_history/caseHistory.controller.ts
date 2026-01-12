import { Controller, Get, Injectable, Query, UseGuards, Param } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiOkResponse, ApiUnauthorizedResponse, ApiBearerAuth, ApiTags, ApiParam, ApiResponse, } from "@nestjs/swagger";
import { TazamaAuthGuard } from "src/guards/tazama-auth.guard";
import { CaseHistoryService } from "./caseHistory.service";
import { LoggerService } from "@tazama-lf/frms-coe-lib";
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from "src/decorators/auth.decorator";

@ApiTags('CaseHistory')
@Controller('api/v1/case-history')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseHistoryController {

    constructor(private readonly caseHistoryService: CaseHistoryService, private readonly loggerService: LoggerService) { }

    @Get()
    @ApiOperation({ summary: 'Fetch case History', description: 'Returns event logs with pagination support.' })
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
        return this.caseHistoryService.getLogs(Number(limit), Number(offset));
    }

    @Get(':caseId')
    @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
    @ApiOperation({
        summary: 'Get case action history',
        description: 'Retrieve all actions taken on a specific case',
    })
    @ApiParam({
        name: 'caseId',
        type: 'number',
        description: 'ID of the case',
        example: '1',
    })
    @ApiResponse({
        status: 200,
        description: 'Action history retrieved successfully',
    })
    @ApiResponse({ status: 404, description: 'Case History not found' })
    async getCaseHistory(@Param('caseId') caseId: number) {
        this.loggerService.log(`Cases are: ${caseId}`);
        return this.caseHistoryService.getCaseHistory(caseId);
    }
}