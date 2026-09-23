import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseEventsGateway } from './case-events.gateway';

@Module({
  imports: [PrismaModule],
  providers: [CaseEventsGateway],
  exports: [CaseEventsGateway],
})
export class CaseEventsModule {}
