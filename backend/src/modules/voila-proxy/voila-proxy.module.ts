import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoilaProxyController } from './voila-proxy.controller';
import { VoilaProxyService } from './voila-proxy.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [ConfigModule, SharedModule],
  controllers: [VoilaProxyController],
  providers: [VoilaProxyService],
  exports: [VoilaProxyService],
})
export class VoilaProxyModule {}
