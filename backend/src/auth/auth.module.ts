import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthHelperService } from './auth-helper.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { ConfigModule } from '@nestjs/config';
import { TazamaAuthGuard } from './tazama-auth.guard';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [ConfigModule, PrismaModule, HttpModule, AuditLogModule, LoggerModule],
  providers: [TazamaAuthGuard, AuthService, AuthHelperService],
  exports: [TazamaAuthGuard, AuthService, AuthHelperService],
  controllers: [AuthController],
})
export class AuthModule {}
