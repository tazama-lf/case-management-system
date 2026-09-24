import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { CaseHistory } from '@prisma/client-cms';
import { CaseInvestigatorService } from '../case-investigator/case-investigator.service';

@Injectable()
export class CaseHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseInvestigatorService: CaseInvestigatorService,
  ) {}

  async logCaseHistoryAction(data: {
    userId?: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    case_id: number;
    tenant_id: string;
    performedAt?: Date;
  }): Promise<CaseHistory> {
    const userId = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return await this.prisma.caseHistory.create({
      data: {
        user_id: userId,
        tenant_id: data.tenant_id,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        case_id: data.case_id,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }

  async getLogs(tenantId: string, userId: string, role: string, limit = 50, offset = 0): Promise<CaseHistory[]> {
    // Tenant-wide list: without this, an investigator could read history for cases
    // that GET /case-history/:caseId would 404 for them.
    const caseIds = await this.caseInvestigatorService.getCaseIdScope(userId, tenantId, role);
    return await this.prisma.caseHistory.findMany({
      where: { tenant_id: tenantId, ...(caseIds ? { case_id: { in: caseIds } } : {}) },
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getCaseHistory(caseId: number, tenantId: string, userId: string, role: string): Promise<CaseHistory[]> {
    await this.caseInvestigatorService.assertReadAccess(caseId, userId, tenantId, role);
    return await this.prisma.caseHistory.findMany({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
    });
  }
}
