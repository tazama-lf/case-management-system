import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [ConfigModule, PrismaModule, HttpModule, LoggerModule],
  providers: [TazamaAuthGuard, AuthService],
  exports: [TazamaAuthGuard, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
