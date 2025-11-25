import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogModule } from '../audit/auditLog.module';

@Module({
  imports: [AuditLogModule],
  providers: [ProfileService, PrismaService],
  controllers: [ProfileController],
})
export class ProfileModule {}
