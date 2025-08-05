import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
<<<<<<< HEAD
<<<<<<< HEAD
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
<<<<<<< HEAD

import { Logger } from '@nestjs/common';

@Module({
  imports: [PassportModule, PrismaModule, HttpModule, AuditLogModule],
  providers: [JwtStrategy, AuthService, { provide: Logger, useClass: Logger }],
  exports: [PassportModule, JwtStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
=======
=======
import { HttpModule } from '@nestjs/axios';
>>>>>>> ea2f4e8 (feat:auth)
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
=======
>>>>>>> 68856f4 (feat: Test Coverage)

import { Logger } from '@nestjs/common';

@Module({
  imports: [PassportModule, PrismaModule, HttpModule, AuditLogModule],
  providers: [JwtStrategy, AuthService, { provide: Logger, useClass: Logger }],
  exports: [PassportModule, JwtStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
<<<<<<< HEAD
>>>>>>> 63fc0de (feat:implementing the auth service)
=======
>>>>>>> ac7173e (feat: Test Coverage)
