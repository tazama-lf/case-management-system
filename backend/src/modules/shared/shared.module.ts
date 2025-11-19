import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CasePriorityUtil } from './utils/case-priority.util';
import { TaskValidationUtil } from './utils/task-validation.util';
import { UserService } from './user.service';
import { SharedService } from './shared.service';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';

@Global()
@Module({
  imports: [ConfigModule, AuthModule, TaskModule],
  providers: [CasePriorityUtil, UserService, SharedService],
  exports: [CasePriorityUtil, UserService, SharedService],
})
export class SharedModule {}
