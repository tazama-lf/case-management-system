import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './report.service';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from 'src/auth/auth.decorator';
import { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(TazamaAuthGuard)
export class ReportsController {
  @Get('task-completion')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get task completion report', description: 'Retrieve task completion analytics for charts and tables' })
  @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
  async getTaskCompletion(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getTaskCompletion(dateRange);
  }

  @Get('case-ageing')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get case ageing report', description: 'Retrieve case ageing analytics for charts and tables' })
  @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
  async getCaseAgeing(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getCaseAgeing(dateRange);
  }

  @Get('audit-logs')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get audit logs report', description: 'Retrieve audit logs for charts and tables' })
  @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
  async getAuditLogs(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getAuditLogs(dateRange);
  }

  @Get('investigator-workload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get investigator workload report', description: 'Retrieve investigator workload analytics for charts and tables' })
  @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
  async getInvestigatorWorkload(@Query('dateRange') dateRange?: string) {
    return this.reportsService.getInvestigatorWorkload(dateRange);
  }
  constructor(private readonly reportsService: ReportsService) {}
          @ApiOperation({ summary: 'Export case status report', description: 'Export case status report as CSV, Excel, or PDF' })
          @ApiQuery({ name: 'format', required: true, enum: ['csv', 'excel', 'pdf'], description: 'Export format' })
          @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
          @ApiQuery({ name: 'caseType', required: false, enum: ['FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE'], description: 'Filter by case type' })
          @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Filter by case priority' })
          @ApiQuery({ name: 'investigator', required: false, description: 'Filter by investigator user ID' })
          async exportCaseStatus(
          @Query('format') format: 'csv' | 'excel' | 'pdf',
          @Res() res: Response,
          @Query('dateRange') dateRange?: string,
          @Query('caseType') caseType?: string,
          @Query('priority') priority?: string,
          @Query('investigator') investigator?: string
          ) {
            const buffer = await this.reportsService.exportCaseStatusReport(format, dateRange, { caseType, priority, investigator });
            if (!buffer || (typeof buffer === 'string' && buffer === '')) {
              return res.status(204).send();
            }
            if (format === 'csv') {
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', 'attachment; filename="case-status.csv"');
              return res.send(buffer);
            }
            if (format === 'excel') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="case-status.xlsx"');
              return res.send(buffer);
            }
            if (format === 'pdf') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="case-status.pdf"');
              return res.send(buffer);
            }
            return res.status(400).json({ message: 'Invalid format' });
          }

          @Get('task-completion/export')
          @RequireInvestigatorOrSupervisorRole()
          @ApiOperation({ summary: 'Export task completion report', description: 'Export task completion report as CSV, Excel, or PDF' })
          @ApiQuery({ name: 'format', required: true, enum: ['csv', 'excel', 'pdf'], description: 'Export format' })
          @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
          async exportTaskCompletion(
          @Query('format') format: 'csv' | 'excel' | 'pdf',
          @Res() res: Response,
          @Query('dateRange') dateRange?: string
          ) {
            const buffer = await this.reportsService.exportTaskCompletionReport(format, dateRange);
            if (!buffer || (typeof buffer === 'string' && buffer === '')) {
              return res.status(204).send();
            }
            if (format === 'csv') {
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', 'attachment; filename="task-completion.csv"');
              return res.send(buffer);
            }
            if (format === 'excel') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="task-completion.xlsx"');
              return res.send(buffer);
            }
            if (format === 'pdf') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="task-completion.pdf"');
              return res.send(buffer);
            }
            return res.status(400).json({ message: 'Invalid format' });
          }

          @Get('audit-logs/export')
          @RequireInvestigatorOrSupervisorRole()
          @ApiOperation({ summary: 'Export audit logs report', description: 'Export audit logs report as CSV, Excel, or PDF' })
          @ApiQuery({ name: 'format', required: true, enum: ['csv', 'excel', 'pdf'], description: 'Export format' })
          @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
          async exportAuditLogs(
          @Query('format') format: 'csv' | 'excel' | 'pdf',
          @Res() res: Response,
          @Query('dateRange') dateRange?: string
          ) {
            const buffer = await this.reportsService.exportAuditLogsReport(format, dateRange);
            if (!buffer || (typeof buffer === 'string' && buffer === '')) {
              return res.status(204).send();
            }
            if (format === 'csv') {
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
              return res.send(buffer);
            }
            if (format === 'excel') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.xlsx"');
              return res.send(buffer);
            }
            if (format === 'pdf') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.pdf"');
              return res.send(buffer);
            }
            return res.status(400).json({ message: 'Invalid format' });
          }

          @Get('case-ageing/export')
          @RequireInvestigatorOrSupervisorRole()
          @ApiOperation({ summary: 'Export case ageing report', description: 'Export case ageing report as CSV, Excel, or PDF' })
          @ApiQuery({ name: 'format', required: true, enum: ['csv', 'excel', 'pdf'], description: 'Export format' })
          @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
          async exportCaseAgeing(
          @Query('format') format: 'csv' | 'excel' | 'pdf',
          @Res() res: Response,
          @Query('dateRange') dateRange?: string
          ) {
            const buffer = await this.reportsService.exportCaseAgeingReport(format, dateRange);
            if (!buffer || (typeof buffer === 'string' && buffer === '')) {
              return res.status(204).send();
            }
            if (format === 'csv') {
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', 'attachment; filename="case-ageing.csv"');
              return res.send(buffer);
            }
            if (format === 'excel') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="case-ageing.xlsx"');
              return res.send(buffer);
            }
            if (format === 'pdf') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="case-ageing.pdf"');
              return res.send(buffer);
            }
            return res.status(400).json({ message: 'Invalid format' });
          }

          @Get('investigator-workload/export')
          @RequireInvestigatorOrSupervisorRole()
          @ApiOperation({ summary: 'Export investigator workload report', description: 'Export investigator workload as CSV, Excel, or PDF' })
          @ApiQuery({ name: 'format', required: true, enum: ['csv', 'excel', 'pdf'], description: 'Export format' })
          @ApiQuery({ name: 'dateRange', required: false, enum: ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'], description: 'Time period for the report data', example: 'last30' })
          async exportInvestigatorWorkload(
          @Query('format') format: 'csv' | 'excel' | 'pdf',
          @Res() res: Response,
          @Query('dateRange') dateRange?: string
          ) {
            const buffer = await this.reportsService.exportInvestigatorWorkloadReport(format, dateRange);
            if (!buffer || (typeof buffer === 'string' && buffer === '')) {
              return res.status(204).send();
            }
            if (format === 'csv') {
              res.setHeader('Content-Type', 'text/csv');
              res.setHeader('Content-Disposition', 'attachment; filename="investigator-workload.csv"');
              return res.send(buffer);
            }
            if (format === 'excel') {
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="investigator-workload.xlsx"');
              return res.send(buffer);
            }
            if (format === 'pdf') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="investigator-workload.pdf"');
              return res.send(buffer);
            }
            return res.status(400).json({ message: 'Invalid format' });
          }

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
          getCaseStatus(
            @Query('dateRange') dateRange?: string,
            @Query('caseType') caseType?: string,
            @Query('priority') priority?: string,
            @Query('investigator') investigator?: string
          ) {
            return this.reportsService.getCaseStatus(dateRange, { caseType, priority, investigator });
          }
        }

