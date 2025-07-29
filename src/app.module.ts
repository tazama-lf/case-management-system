import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
import { TriageModule } from './triage/triage.module';
import { PrismaModule } from 'prisma/prisma.module';
import { PrismaService } from 'prisma/prisma.service';


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
  providers: [PrismaService],
})
export class AppModule {}