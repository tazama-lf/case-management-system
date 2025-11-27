import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaDWHService } from './prismaDWH.service';
@Module({
  imports: [ConfigModule],
  providers: [PrismaDWHService],
  exports: [PrismaDWHService],
})
export class PrismaDWHModule {}
