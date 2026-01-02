import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { AuditLogModule } from '../audit/auditLog.module';
import { PrismaModule } from 'prisma/prisma.module';
import { CouchdbModule } from '../couchdb/couchdb.module';
import { RepositoryModule } from '../repository/repository.module';
import { EventLogModule } from '../event_log/eventLog.module';

@Module({
  imports: [
    PrismaModule,
    CouchdbModule,
    AuditLogModule,
    RepositoryModule,
    EventLogModule,
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
export class EvidenceModule { }
