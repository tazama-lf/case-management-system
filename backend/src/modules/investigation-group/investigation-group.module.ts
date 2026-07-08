import { Module } from '@nestjs/common';
import { InvestigationGroupService } from './investigation-group.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InvestigationGroupService],
  exports: [InvestigationGroupService],
})
export class InvestigationGroupModule {}
