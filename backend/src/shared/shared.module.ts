import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CasePriorityUtil } from './utils/case-priority.util';
import { TaskValidationUtil } from './utils/task-validation.util';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [CasePriorityUtil],
    exports: [CasePriorityUtil],
})
export class SharedModule {}