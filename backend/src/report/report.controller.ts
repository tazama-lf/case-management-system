import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ReportsService } from './report.service';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from 'src/auth/auth.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(TazamaAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('case-status')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ 
    summary: 'Get case status report',
    description: 'Retrieve comprehensive case status analytics including distribution, types, outcomes, and trends'
  })
  @ApiQuery({ 
    name: 'dateRange', 
    required: false, 
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30'
  })
  @ApiQuery({ 
    name: 'caseType', 
    required: false, 
    enum: ['FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE'],
    description: 'Filter by case type'
  })
  @ApiQuery({ 
    name: 'priority', 
    required: false, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    description: 'Filter by case priority'
  })
  @ApiQuery({ 
    name: 'investigator', 
    required: false, 
    description: 'Filter by investigator user ID'
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
            avgResolutionTime: { type: 'number', example: 12.5 }
          }
        },
        statusDistribution: {
          type: 'object',
          properties: {
            assigned: { type: 'number', example: 25 },
            inProgress: { type: 'number', example: 30 },
            draft: { type: 'number', example: 10 },
            suspended: { type: 'number', example: 5 },
            pendingApproval: { type: 'number', example: 8 },
            closed: { type: 'number', example: 45 }
          }
        },
        caseTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'FRAUD' },
              count: { type: 'number', example: 75 },
              color: { type: 'string', example: '#ef4444' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getCaseStatus(
    @Query('dateRange') dateRange?: string,
    @Query('caseType') caseType?: string,
    @Query('priority') priority?: string,
    @Query('investigator') investigator?: string
  ) {
    return this.reportsService.getCaseStatus(dateRange, { caseType, priority, investigator });
  }

  @Get('investigator-workload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ 
    summary: 'Get investigator workload report',
    description: 'Retrieve investigator performance metrics including case loads, completion rates, and efficiency data'
  })
  @ApiQuery({ 
    name: 'dateRange', 
    required: false, 
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30'
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
            caseClosureRate: { type: 'number', example: 0 }
          }
        },
        workloadData: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'User 12345678' },
              activeCases: { type: 'number', example: 15 },
              pendingTasks: { type: 'number', example: 8 }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getInvestigatorWorkload(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getInvestigatorWorkload(dateRange);
  }

  @Get('audit-logs')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ 
    summary: 'Get audit logs report',
    description: 'Retrieve audit trail data including user actions, system events, and compliance information'
  })
  @ApiQuery({ 
    name: 'dateRange', 
    required: false, 
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Audit logs report data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stats: {
          type: 'object',
          properties: {
            totalLogs: { type: 'number', example: 500 },
            caseActions: { type: 'number', example: 150 },
            userSessions: { type: 'number', example: 75 },
            systemWarnings: { type: 'number', example: 12 }
          }
        },
        auditLogs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              audit_log_id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              user_id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
              operation: { type: 'string', example: 'UPDATE' },
              entity_name: { type: 'string', example: 'Case' },
              action_performed: { type: 'string', example: 'Case status updated' },
              outcome: { type: 'string', example: 'SUCCESS' },
              performed_at: { type: 'string', example: '10/22/2025, 02:30:45 PM' },
              type: { type: 'string', example: 'Success' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getAuditLogs(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getAuditLogs(dateRange);
  }

  @Get('case-ageing')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ 
    summary: 'Get case ageing report',
    description: 'Retrieve case ageing analytics including duration metrics, ageing distribution, and resolution trends'
  })
  @ApiQuery({ 
    name: 'dateRange', 
    required: false, 
    enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'],
    description: 'Time period for the report data',
    example: 'last30'
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
            casesOver30Days: { type: 'number', example: 8 }
          }
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
              age30Plus: { type: 'number', example: 3 }
            }
          }
        },
        ageingDistribution: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ageRange: { type: 'string', example: '0-7 days' },
              count: { type: 'number', example: 45 },
              percentage: { type: 'number', example: 30 },
              color: { type: 'string', example: '#10b981' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getCaseAgeing(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getCaseAgeing(dateRange);
  }

  @Get('filters')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ 
    summary: 'Get report filters',
    description: 'Retrieve available filter options for reports including case types, priorities, and investigators'
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
              label: { type: 'string', example: 'Fraud' }
            }
          }
        },
        priorities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: 'HIGH' },
              label: { type: 'string', example: 'High' }
            }
          }
        },
        investigators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              label: { type: 'string', example: 'User 12345678' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getFilters() {
    return this.reportsService.getFilters();
  }
}
