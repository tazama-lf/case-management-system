import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaDWHModule } from '../../prismaDWH/prismaDWH.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuditLogModule, PrismaDWHModule, PrismaModule],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
