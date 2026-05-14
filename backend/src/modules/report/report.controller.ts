import {
  Controller,
  Get,
  Query,
  Req,
  MaxFileSizeValidator,
  UseGuards,
  Post,
  Put,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ReportsService } from './report.service';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import {
  RequireInvestigatorOrSupervisorRole,
  RequireInvestigatorOrSupervisorRoleOrComplianceRole,
  RequireSupervisorRole,
} from 'src/decorators/auth.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { UploadReportDto } from './dto/upload-report.dto';
// import { Multer } from 'multer';
import { Express } from 'express';
import { FraudReport, FraudReportOutcome } from './report.model';
import { Audit } from '../audit/decorators/audit-log.decorator';

@ApiTags('Reports')
@ApiBearerAuth('jwt')
@Controller('api/v1/reports')
@UseGuards(TazamaAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // --- Fraud Report Endpoints ---

  @Post('fraud/generate')
  @RequireSupervisorRole()
  @Audit()
  @ApiOperation({ summary: 'Generate fraud investigation report', description: 'Create a new fraud investigation report for a case.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'any',
          items: { type: 'string', format: 'binary' },
        },
        caseId: {
          type: 'number',
          description: 'Case ID',
        },
        description: {
          type: 'string',
          description: 'Description of the report',
        },
        reportType: {
          type: 'string',
          enum: ['INVESTIGATION_REPORT'],
          description: 'Type of evidence',
        },
        investigatorInputs: {
          type: 'string',
          example: 'Initial investigation completed. Evidence collected.',
        },
        supervisorRemarks: {
          type: 'string',
          example: 'Please review findings and recommendations.',
        },
        outcome: {
          type: 'string',
          example: 'Under Monitoring',
        },
      },
      required: ['file', 'caseId', 'reportType'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 201, description: 'Fraud report generated successfully.' })
  async generateFraudReport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadReportDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<FraudReport> {
    if (!dto.caseId) {
      throw new Error(`caseId is required: ${dto.caseId}`);
    }
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    const role = 'CMS_SUPERVISOR';
    return await this.reportsService.generateFraudReport(file, dto, userId, tenantId, role);
  }

  @Put('fraud/edit/:reportId')
  @RequireInvestigatorOrSupervisorRole()
  @Audit()
  @ApiOperation({ summary: 'Edit fraud investigation report', description: 'Edit an existing fraud investigation report.' })
  @ApiResponse({ status: 200, description: 'Fraud report updated successfully.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keyFindings: { type: 'string', example: 'Fraud confirmed after review.' },
        recommendations: { type: 'string', example: 'Escalate to compliance for further action.' },
        supervisorRemarks: { type: 'string', example: 'Reviewed and ready for approval.' },
        decisions: { type: 'string', example: 'Confirmed Fraud' },
      },
      required: ['keyFindings', 'recommendations', 'supervisorRemarks'],
    },
    examples: {
      default: {
        summary: 'Sample edit request',
        value: {
          keyFindings: 'Fraud confirmed after review.',
          recommendations: 'Escalate to compliance for further action.',
          supervisorRemarks: 'Reviewed and ready for approval.',
          decisions: 'Confirmed Fraud',
        },
      },
    },
  })
  async editFraudReport(
    @Req() req: AuthenticatedRequest,
    @Param('reportId') reportId: string,
    @Body() updates: Partial<FraudReport>,
  ): Promise<FraudReport> {
    const userId = req.user.token.clientId;
    return await this.reportsService.editFraudReport(reportId, updates, userId);
  }

  @Post('fraud/approve')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Approve fraud investigation report', description: 'Approve a fraud investigation report and archive it.' })
  @ApiResponse({ status: 200, description: 'Fraud report approved and archived.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reportId: { type: 'string', example: '8f26bfd5-b308-49f1-bdec-1cb26fa477a4-v1' },
        outcome: { type: 'string', enum: ['Confirmed Fraud', 'Refuted Fraud', 'Under Monitoring'], example: 'Confirmed Fraud' },
        supervisor: { type: 'string', example: 'Jane Supervisor' },
        supervisorUserId: { type: 'string', example: '1d2282cb-5733-4755-bf3f-677074fb9cd6' },
      },
      required: ['reportId', 'outcome', 'supervisor', 'supervisorUserId'],
    },
    examples: {
      default: {
        summary: 'Sample approve request',
        value: {
          reportId: '8f26bfd5-b308-49f1-bdec-1cb26fa477a4-v1',
          outcome: 'Confirmed Fraud',
          supervisor: 'Jane Supervisor',
          supervisorUserId: '1d2282cb-5733-4755-bf3f-677074fb9cd6',
        },
      },
    },
  })
  @Audit()
  async approveFraudReport(
    @Body() body: { reportId: string; outcome: FraudReportOutcome; supervisor: string; supervisorUserId: string },
  ): Promise<FraudReport> {
    return await this.reportsService.approveFraudReport(body.reportId, body.outcome, body.supervisor, body.supervisorUserId);
  }

  @Get('fraud/:caseId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get fraud investigation reports for a case',
    description: 'Retrieve all fraud investigation reports for a given case.',
  })
  @ApiResponse({ status: 200, description: 'Fraud reports retrieved successfully.' })
  async getFraudReports(@Param('caseId') caseId: string): Promise<FraudReport[]> {
    return await this.reportsService.getFraudReports(caseId);
  }

  @Get('case-status')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get case status report',
    description: 'Retrieve comprehensive case status analytics including distribution, types, outcomes, and trends',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30',
  })
  @ApiQuery({
    name: 'caseType',
    required: false,
    enum: ['FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE'],
    description: 'Filter by case type',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    description: 'Filter by case priority',
  })
  @ApiQuery({
    name: 'investigator',
    required: false,
    description: 'Filter by investigator user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Case status report data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            totalCases: { type: 'number', example: 150 },
            closedCases: { type: 'number', example: 45 },
            openCases: { type: 'number', example: 105 },
            avgResolutionTime: { type: 'number', example: 12.5 },
          },
        },
        statusDistribution: {
          type: 'object',
          properties: {
            assigned: { type: 'number', example: 25 },
            inProgress: { type: 'number', example: 30 },
            draft: { type: 'number', example: 10 },
            suspended: { type: 'number', example: 5 },
            pendingApproval: { type: 'number', example: 8 },
            closed: { type: 'number', example: 45 },
          },
        },
        caseTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'FRAUD' },
              count: { type: 'number', example: 75 },
              color: { type: 'string', example: '#ef4444' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCaseStatus(
    @Req() req: AuthenticatedRequest,
    @Query('dateRange') dateRange?: string,
    @Query('caseType') caseType?: string,
    @Query('priority') priority?: string,
    @Query('investigator') investigator?: string,
  ): Promise<unknown> {
    const { tenantId } = req.user.token;
    const userId = req.user.token.clientId;
    const userClaims = req.user.token.claims;

    // Check if user is investigator (not supervisor/admin)
    const isInvestigator =
      userClaims.includes('CMS_INVESTIGATOR') && !userClaims.includes('CMS_SUPERVISOR') && !userClaims.includes('CMS_ADMIN');

    return await this.reportsService.getCaseStatus(dateRange, {
      caseType,
      priority,
      investigator,
      tenantId,
      requestingUserId: isInvestigator ? userId : undefined,
    });
  }

  @Get('investigator-workload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get investigator workload report',
    description: 'Retrieve investigator performance metrics including case loads, completion rates, and efficiency data',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30',
  })
  @ApiResponse({
    status: 200,
    description: 'Investigator workload report data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            totalInvestigators: { type: 'number', example: 8 },
            avgCasesPerInvestigator: { type: 'number', example: 18.8 },
            avgResolutionTime: { type: 'number', example: 0 },
            caseClosureRate: { type: 'number', example: 0 },
          },
        },
        workloadData: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'User 12345678' },
              activeCases: { type: 'number', example: 15 },
              pendingTasks: { type: 'number', example: 8 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInvestigatorWorkload(@Query('dateRange') dateRange?: string): Promise<unknown> {
    return await this.reportsService.getInvestigatorWorkload(dateRange);
  }

  @Get('event-logs')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get event logs report',
    description: 'Retrieve event trail data including user actions, system events, and compliance information',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30',
  })
  @ApiResponse({
    status: 200,
    description: 'Event logs report data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            totalLogs: { type: 'number', example: 500 },
            caseActions: { type: 'number', example: 150 },
            userSessions: { type: 'number', example: 75 },
            systemWarnings: { type: 'number', example: 12 },
          },
        },
        eventLogs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              event_log_id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              user_id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
              operation: { type: 'string', example: 'UPDATE' },
              entity_name: { type: 'string', example: 'Case' },
              action_performed: { type: 'string', example: 'Case status updated' },
              outcome: { type: 'string', example: 'SUCCESS' },
              performed_at: { type: 'string', example: '10/22/2025, 02:30:45 PM' },
              type: { type: 'string', example: 'Success' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getEventLogs(@Query('dateRange') dateRange?: string): Promise<unknown> {
    return await this.reportsService.getEventLogs(dateRange);
  }

  @Get('case-ageing')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get case ageing report',
    description: 'Retrieve case ageing analytics including duration metrics, ageing distribution, and resolution trends',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30',
  })
  @ApiResponse({
    status: 200,
    description: 'Case ageing report data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            avgCaseAge: { type: 'number', example: 18.5 },
            avgResolutionTime: { type: 'number', example: 0 },
            casesOver15Days: { type: 'number', example: 25 },
            casesOver30Days: { type: 'number', example: 8 },
          },
        },
        ageingByStatus: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              status: { type: 'string', example: '20 IN PROGRESS' },
              age0to7: { type: 'number', example: 15 },
              age8to15: { type: 'number', example: 10 },
              age16to30: { type: 'number', example: 8 },
              age30Plus: { type: 'number', example: 3 },
            },
          },
        },
        ageingDistribution: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ageRange: { type: 'string', example: '0-7 days' },
              count: { type: 'number', example: 45 },
              percentage: { type: 'number', example: 30 },
              color: { type: 'string', example: '#10b981' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCaseAgeing(@Req() req: AuthenticatedRequest, @Query('dateRange') dateRange?: string): Promise<unknown> {
    const { tenantId } = req.user.token;
    const userId = req.user.token.clientId;
    const userClaims = req.user.token.claims;

    // Check if user is investigator (not supervisor/admin)
    const isInvestigator =
      userClaims.includes('CMS_INVESTIGATOR') && !userClaims.includes('CMS_SUPERVISOR') && !userClaims.includes('CMS_ADMIN');

    return await this.reportsService.getCaseAgeing(dateRange, {
      tenantId,
      requestingUserId: isInvestigator ? userId : undefined,
    });
  }

  @Get('filters')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get report filters',
    description: 'Retrieve available filter options for reports including case types, priorities, and investigators',
  })
  @ApiResponse({
    status: 200,
    description: 'Report filters retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        caseTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: 'FRAUD' },
              label: { type: 'string', example: 'Fraud' },
            },
          },
        },
        priorities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: 'HIGH' },
              label: { type: 'string', example: 'High' },
            },
          },
        },
        investigators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              label: { type: 'string', example: 'User 12345678' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getFilters(): Promise<unknown> {
    return await this.reportsService.getFilters();
  }
}
