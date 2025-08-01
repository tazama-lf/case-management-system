import { Module } from '@nestjs/common';
import { AuditLogService } from './auditLog.service';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { PrismaModule } from '../../prisma/prisma.module';
=======
import { AuditLogController } from './auditLog.controller';
=======
>>>>>>> a4489c4 (feat/prisma)
=======
>>>>>>> 3fd91ce (fix: remove invalid AuditLogController import)
import { PrismaModule } from '../prisma.module';
>>>>>>> 9e1ce67 (feat: audit log)
=======
import { PrismaModule } from 'prisma/prisma.module';
<<<<<<< HEAD
>>>>>>> fd5a237 (feat:auth)
=======
import { PassportModule } from '@nestjs/passport';
>>>>>>> ea2f4e8 (feat:auth)
=======
import { PrismaModule } from '../../prisma/prisma.module';
>>>>>>> 68856f4 (feat: Test Coverage)

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
  controllers: [AuditLogController],
>>>>>>> 9e1ce67 (feat: audit log)
=======
  controllers: [],
>>>>>>> a4489c4 (feat/prisma)
=======
>>>>>>> 3fd91ce (fix: remove invalid AuditLogController import)
  exports: [AuditLogService],
})
export class AuditLogModule {}
