import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CouchdbService } from './couchdb.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CouchdbService],
  exports: [CouchdbService],
})
export class CouchdbModule {}
