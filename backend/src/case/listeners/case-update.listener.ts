import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../../audit/auditLog.service';
import { Outcome } from '../../audit/types/outcome';

@Injectable()
export class CaseUpdateListener {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly logger: LoggerService,
        private readonly auditLogService: AuditLogService,
    ) {}

    @OnEvent('case.update.requested')
    async handleCaseUpdateRequested(event: {
        caseId: string;
        updateData: any;
        userId: string;
    }) {
        try {
            const updatedCase = await this.prismaService.case.update({
                where: { case_id: event.caseId },
                data: {
                    case_type: event.updateData.caseType,
                    priority: event.updateData.priority,
                    status: event.updateData.status,
                    case_owner_user_id: event.updateData.caseOwnerUserId,
                },
            });

            await this.auditLogService.logAction({
                userId: event.userId,
                operation: 'updateCase',
                entityName: 'Case',
                actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
                outcome: Outcome.SUCCESS,
            });

            this.logger.log(`Case ${event.caseId} updated via event`, CaseUpdateListener.name);
        } catch (error) {
            this.logger.error(
                `Failed to update case ${event.caseId}: ${error.message}`,
                error.stack,
                CaseUpdateListener.name,
            );
        }
    }
}