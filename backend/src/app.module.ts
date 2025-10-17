import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogModule } from './audit/auditLog.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './auth/token-expiry.interceptor';
import { SharedModule } from './shared/shared.module'; // Add this
import { CaseWorkflowModule } from './case-workflow/case-workflow.module';
import { TriageModule } from './triage/triage.module';
import { CaseModule } from './case/case.module';
import { CommentModule } from './comment/comment.module';
import { TaskModule } from './task/task.module';
import { NatsModule } from './nats/nats.module';
import { SystemConfigModule } from './config/config.module';
import { FlowableModule } from './flowable/flowable.module';
import { WorkQueueModule } from './work-queue/work-queue.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validate,
    }),
    EventEmitterModule.forRoot(),
    SharedModule, // Add this before other modules
    PrismaModule,
    CaseWorkflowModule,
    FlowableModule,
    NatsModule,
    AuditLogModule,
    TriageModule,
    CommentModule,
    CaseModule,
    TaskModule,
    AuthModule,
    SystemConfigModule,
    WorkQueueModule,
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
