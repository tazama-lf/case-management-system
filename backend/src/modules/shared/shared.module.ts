import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CasePriorityUtil } from './utils/case-priority.util';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [ConfigModule, AuthModule, HttpModule],
  providers: [CasePriorityUtil, RedisService, CacheService],
  exports: [CasePriorityUtil, RedisService, CacheService],
})
export class SharedModule {}
