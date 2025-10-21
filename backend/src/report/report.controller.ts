import { Controller, Get, Query, Req, UseGuards, Res } from '@nestjs/common';
import { RequireAnyClaims } from '../auth/auth.decorator';
import { ReportService } from './report.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { Response } from 'express';

@RequireAnyClaims('CMS_ANALYST', 'CMS_SUPERVISOR')
@Controller('api/v1/reports')
@UseGuards(TazamaAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('investigator-workload')
  async getInvestigatorWorkload(
    @Req() req,
    @Query() query,
    @Res() res: Response
  ) {
    const { format = 'json', ...filters } = query;

  // Extract tenantId and roles/claims from the authenticated user object
  const tenantId = req.user.token.tenantId;
  const userClaims = req.user.token.claims || [];


    // RBAC: Only allow CMS_ANALYST or CMS_SUPERVISOR
    if (!userClaims.includes('CMS_ANALYST') && !userClaims.includes('CMS_SUPERVISOR')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const data = await this.reportService.getInvestigatorWorkloadReport(filters, tenantId);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="investigator-workload.csv"');
      const csv = await this.reportService.exportReport(data, 'csv');
      return res.send(csv);
    }

    // Add PDF/Excel export as needed

    return res.json(data);
  }
}