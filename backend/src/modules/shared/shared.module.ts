import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CasePriorityUtil } from './utils/case-priority.util';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [ConfigModule, AuthModule],
  providers: [CasePriorityUtil, UserService],
  exports: [CasePriorityUtil, UserService],
})
export class SharedModule {}
