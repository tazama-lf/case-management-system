import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
import { TriageModule } from './triage/triage.module';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaController } from './prisma/prisma.controller';
import { PrismaModule } from '../prisma/prisma.module';

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
  controllers: [PrismaController],
})
export class AppModule {}