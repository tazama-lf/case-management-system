import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CasePriorityUtil } from './utils/case-priority.util';
import { SlaPolicyUtil } from './utils/sla-policy.util';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule), HttpModule, PrismaModule],
  providers: [CasePriorityUtil, SlaPolicyUtil, RedisService, CacheService],
  exports: [CasePriorityUtil, SlaPolicyUtil, RedisService, CacheService],
})
export class SharedModule {}
