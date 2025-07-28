import { Module } from '@nestjs/common';
import { AuditLogService } from './auditLog.service';
<<<<<<< HEAD
import { PrismaModule } from '../../prisma/prisma.module';
=======
import { AuditLogController } from './auditLog.controller';
import { PrismaModule } from '../prisma.module';
>>>>>>> 9e1ce67 (feat: audit log)

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
<<<<<<< HEAD
=======
  controllers: [AuditLogController],
>>>>>>> 9e1ce67 (feat: audit log)
  exports: [AuditLogService],
})
export class AuditLogModule {}
