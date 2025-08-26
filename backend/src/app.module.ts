import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './auth/token-expiry.interceptor';
import { TriageModule } from './triage/triage.module';
import { NatsModule } from './nats/nats.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    NatsModule,
    AuditLogModule,
    TriageModule,
    AuthModule,
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
