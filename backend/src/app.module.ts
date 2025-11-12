import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogModule } from './audit/auditLog.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './auth/token-expiry.interceptor';
import { SharedModule } from './shared/shared.module';
import { CaseCreationModule } from './case-creation/case-creation.module';
import { TriageModule } from './triage/triage.module';
import { CaseModule } from './case/case.module';
import { CommentModule } from './comment/comment.module';
import { TaskModule } from './task/task.module';
import { NatsModule } from './nats/nats.module';
import { SystemConfigModule } from './config/config.module';
import { FlowableModule } from './flowable/flowable.module';
import { WorkQueueModule } from './work-queue/work-queue.module';
import { NotificationModule } from './notification/notification.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { ReportsModule } from './report/report.module';
import { validate } from './config/env.validation';
import { ConfigManagementModule } from './config-management/config-management.module';
import { UserModule } from './user/user.module';
import { FeatureExtractionModule } from './feature-extraction/feature-extraction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validate,
    }),
    EventEmitterModule.forRoot(),
    SharedModule,
    PrismaModule,
    CaseCreationModule,
    FlowableModule,
    NatsModule,
    AuditLogModule,
    ConfigManagementModule,
    TriageModule,
    CommentModule,
    CaseModule,
    TaskModule,
    AuthModule,
    SystemConfigModule,
    WorkQueueModule,
    NotificationModule,
    NotificationPreferencesModule,
    ReportsModule,
    UserModule,
    FeatureExtractionModule,
  ],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenExpiryInterceptor,
    },
  ],
})
export class AppModule {}
