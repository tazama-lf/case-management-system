import { Module } from '@nestjs/common';
import { ConfigManagementService } from './config-management.service';
import { ConfigManagementController } from './config-management.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule, AuthModule],
  controllers: [ConfigManagementController],
  providers: [ConfigManagementService],
  exports: [ConfigManagementService],
})
export class ConfigManagementModule {}
