import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';

import { Logger } from '@nestjs/common';

@Module({
  imports: [PassportModule, PrismaModule, HttpModule, AuditLogModule],
  providers: [JwtStrategy, AuthService, { provide: Logger, useClass: Logger }],
  exports: [PassportModule, JwtStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
