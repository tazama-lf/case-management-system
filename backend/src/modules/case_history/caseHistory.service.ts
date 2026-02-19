import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4, validate as isUuid } from 'uuid';

import { LoggerService } from '@tazama-lf/frms-coe-lib';

@Injectable()
export class CaseHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: LoggerService,
  ) {}

  async logCaseHistoryAction(data: {
    userId?: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    case_id: number;
    performedAt?: Date;
  }) {
    const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return await this.prisma.caseHistory.create({
      data: {
        user_id,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        case_id: data.case_id,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }

  async getLogs(limit = 50, offset = 0) {
    return await this.prisma.caseHistory.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }
  async getCaseHistory(caseId: number) {
    return await this.prisma.caseHistory.findMany({
      where: { case_id: caseId },
    });
  }
}
