import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigController } from './config.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ConfigController],
})
export class SystemConfigModule {}
