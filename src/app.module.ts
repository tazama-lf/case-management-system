import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
import { TriageModule } from './triage/triage.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    PrismaModule,
    AuditLogModule,
    TriageModule,
  ],
})
export class AppModule {}