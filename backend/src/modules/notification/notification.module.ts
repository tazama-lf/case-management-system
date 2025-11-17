import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationRetryService } from './notification-retry.service';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, NotificationPreferencesModule, AuthModule],
  providers: [NotificationService, NotificationLogService, NotificationRetryService],
  exports: [NotificationService, NotificationLogService],
})
export class NotificationModule {}
