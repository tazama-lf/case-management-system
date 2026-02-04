import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogModule } from './modules/audit/auditLog.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaDWHModule } from '../prismaDWH/prismaDWH.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './interpectors/token-expiry.interceptor';
import { SharedModule } from './modules/shared/shared.module';
import { TriageModule } from './modules/triage/triage.module';
import { CaseModule } from './modules/case/case.module';
import { CommentModule } from './modules/comment/comment.module';
import { TaskModule } from './modules/task/task.module';
import { NatsModule } from './modules/nats/nats.module';
import { PrismaDWHService } from '../prismaDWH/prismaDWH.service';
import { SystemConfigModule } from './config/config.module';
import { FlowableModule } from './modules/flowable/flowable.module';
import { AsyncTaskModule } from './modules/async-task/async-task.module';
import { NotificationModule } from './modules/notification/notification.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { ReportsModule } from './modules/report/report.module';
import { validate } from './config/env.validation';
import { ConfigManagementModule } from './modules/config-management/config-management.module';
import { UserModule } from './modules/user/user.module';
import { FeatureExtractionModule } from './modules/feature-extraction/feature-extraction.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { AlertModule } from './modules/alert/alert.module';
import { CouchdbModule } from './modules/couchdb/couchdb.module';
import { TazamaDwhModule } from './modules/tazama-dwh/tazama-dwh.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { AdminModule } from './modules/admin/admin.module';
import { FilterModule } from './modules/filter/filter.module'
import { CaseHistoryModule } from './modules/case_history/caseHistory.module';
import { TaskHistoryModule } from './modules/task_history/taskHistory.module';

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
    PrismaDWHModule,
    FlowableModule,
    NatsModule,
    AuditLogModule,
    ConfigManagementModule,
    AdminModule,
    AlertModule,
    TriageModule,
    CommentModule,
    CaseModule,
    TaskModule,
    AuthModule,
    SystemConfigModule,
    AsyncTaskModule,
    NotificationModule,
    NotificationPreferencesModule,
    ReportsModule,
    UserModule,
    FeatureExtractionModule,
    CouchdbModule,
    EvidenceModule,
    TazamaDwhModule,
    FilterModule,
    CaseHistoryModule,
    TaskHistoryModule,
  ],
  providers: [
    PrismaService,
    PrismaDWHService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenExpiryInterceptor,
    },
  ],
})
export class AppModule { }
