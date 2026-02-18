import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

@Injectable()
export class CaseHistoryService {

    constructor(private prisma: PrismaService, private readonly loggerService: LoggerService) { }

    async logCaseHistoryAction(data: {
        userId?: string;
        operation: string;
        entityName: string;
        actionPerformed: string;
        case_id: number;
        tenant_id: string;
        performedAt?: Date;
    }) {
        const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
        return this.prisma.caseHistory.create({
            data: {
                user_id,
                tenant_id: data.tenant_id,
                operation: data.operation,
                entity_name: data.entityName,
                action_performed: data.actionPerformed,
                case_id: data.case_id,
                performed_at: data.performedAt ?? new Date(),
            },
        });
    }

    async getLogs(tenantId: string, limit = 50, offset = 0) {
        return this.prisma.caseHistory.findMany({
            where: { tenant_id: tenantId },
            orderBy: { performed_at: 'desc' },
            take: limit,
            skip: offset,
        });
    }
    async getCaseHistory(caseId: number, tenantId: string) {
        return this.prisma.caseHistory.findMany({
            where: { 
                case_id: caseId,
                tenant_id: tenantId 
            },
        });
    }
}
