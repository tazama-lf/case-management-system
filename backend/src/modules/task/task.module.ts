import { Module, forwardRef } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskLifecycleService } from './services/task-lifecycle.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskController } from './task.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { FlowableModule } from '../flowable/flowable.module';
import { RepositoryModule } from '../repository/repository.module';
import { TaskBridgeModule } from '../task-bridge/task-bridge.module';

@Module({
	imports: [
		PrismaModule,
		AuditLogModule,
		LoggerModule,
		AuthModule,
		NotificationModule,
		FlowableModule,
		RepositoryModule,
		TaskBridgeModule
	],
	providers: [TaskService, TaskLifecycleService],
	exports: [TaskService],
	controllers: [TaskController],
})
export class TaskModule { }
