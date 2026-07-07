import { Module } from '@nestjs/common';
import { AlertPriorityService } from './alert-priority.service';
import { CasePriorityService } from './case-priority.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RepositoryModule } from '../repository/repository.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, RepositoryModule, NotificationModule],
  providers: [AlertPriorityService, CasePriorityService],
  exports: [AlertPriorityService, CasePriorityService],
})
export class AlertPriorityModule {}
