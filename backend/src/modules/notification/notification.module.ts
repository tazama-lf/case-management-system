import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AsyncTaskModule } from '../async-task/async-task.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [PrismaModule, AsyncTaskModule, NotificationPreferencesModule, AuthModule, SharedModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
