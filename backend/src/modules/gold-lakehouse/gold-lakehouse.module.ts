import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { GoldLakehouseController } from './gold-lakehouse.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [GoldLakehouseController],
  providers: [GoldLakehouseService],
  exports: [GoldLakehouseService],
})
export class GoldLakehouseModule {}
