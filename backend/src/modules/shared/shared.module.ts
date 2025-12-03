import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CasePriorityUtil } from './utils/case-priority.util';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { AuthModule } from '../auth/auth.module';
import { UserService } from './user.service';

@Global()
@Module({
  imports: [ConfigModule, AuthModule, HttpModule],
  providers: [CasePriorityUtil, RedisService, CacheService, UserService],
  exports: [CasePriorityUtil, RedisService, CacheService, UserService],
})
export class SharedModule {}
