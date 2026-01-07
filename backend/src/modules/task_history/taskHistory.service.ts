import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';

@Injectable()
export class TaskHistoryService {
    constructor(private prisma: PrismaService) { }

    async logTaskHistoryAction(data: {
        userId?: string;
        operation: string;
        entityName: string;
        actionPerformed: string;
        case_id: number;
        task_id: number;
        performedAt?: Date;
    }) {
        const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
        return this.prisma.taskHistory.create({
            data: {
                user_id,
                operation: data.operation,
                entity_name: data.entityName,
                action_performed: data.actionPerformed,
                task_id: data.task_id,
                case_id: data.case_id,
                performed_at: data.performedAt ?? new Date(),
            },
        });
    }

    async getLogs(limit = 50, offset = 0) {
        return this.prisma.taskHistory.findMany({
            orderBy: { performed_at: 'desc' },
            take: limit,
            skip: offset,
        });
    }
    async getTaskHistory(caseId: number) {
        return this.prisma.taskHistory.findMany({
            where: { case_id: caseId },

        });
    }
}
