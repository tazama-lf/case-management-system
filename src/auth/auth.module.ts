import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [PassportModule, PrismaModule, HttpModule, AuditLogModule, LoggerModule],
  providers: [JwtStrategy, AuthService],
  exports: [PassportModule, JwtStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
