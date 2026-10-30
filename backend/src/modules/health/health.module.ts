import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../../prisma/prisma.module';
import { HealthController } from './health.controller';
import { DependencyHealthIndicator } from './dependency-health.indicator';

@Module({
  imports: [TerminusModule, ConfigModule, PrismaModule],
  controllers: [HealthController],
  providers: [DependencyHealthIndicator],
})
export class HealthModule {}
