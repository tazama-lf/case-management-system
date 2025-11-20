import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogModule } from './modules/audit/auditLog.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './modules/auth/token-expiry.interceptor';
import { SharedModule } from './modules/shared/shared.module';
import { TriageModule } from './modules/triage/triage.module';
import { CaseModule } from './modules/case/case.module';
import { CommentModule } from './modules/comment/comment.module';
import { TaskModule } from './modules/task/task.module';
import { NatsModule } from './modules/nats/nats.module';
import { SystemConfigModule } from './config/config.module';
import { FlowableModule } from './modules/flowable/flowable.module';
import { WorkQueueModule } from './modules/work-queue/work-queue.module';
import { NotificationModule } from './modules/notification/notification.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { ReportsModule } from './modules/report/report.module';
import { validate } from './config/env.validation';
import { ConfigManagementModule } from './modules/config-management/config-management.module';
import { UserModule } from './modules/user/user.module';
import { FeatureExtractionModule } from './modules/feature-extraction/feature-extraction.module';
import { RepositoryModule } from './modules/repository/repository.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validate,
    }),
    EventEmitterModule.forRoot(),
    RepositoryModule,
    SharedModule,
    PrismaModule,
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
