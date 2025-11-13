import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CouchdbModule } from '../couchdb/couchdb.module';
import { AuditLogModule } from '../audit/auditLog.module';

@Module({
  imports: [
    PrismaModule,
    CouchdbModule,
    AuditLogModule,
    MulterModule.register({
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
      storage: require('multer').memoryStorage(),
    }),
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
