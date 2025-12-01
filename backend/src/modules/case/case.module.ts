import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseQueryService } from './services/case-query.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskModule } from 'src/modules/task/task.module';
import { CommentModule } from '../comment/comment.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RepositoryModule } from '../repository/repository.module';
import { CaseClosureApprovalService } from './services/case-closure-approval.service';
import { CaseCreationApprovalService } from './services/case-creation-approval.service';
import { CaseReopeningService } from './services/case-reopening.service';
import { FlowableModule } from '../flowable/flowable.module';
import { UserModule } from '../user/user.module';

@Module({
	imports: [PrismaModule, AuditLogModule, LoggerModule, TaskModule, AuthModule, CommentModule, NotificationModule, RepositoryModule, FlowableModule, UserModule],
	providers: [
		CaseService,
		CaseQueryService,
		CaseClosureApprovalService,
		CaseCreationApprovalService,
		CaseReopeningService
	],
	exports: [
		CaseService,
		CaseQueryService,
		CaseClosureApprovalService,
		CaseCreationApprovalService,
		CaseReopeningService
	],
	controllers: [CaseController],
})
export class CaseModule {}
