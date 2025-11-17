import { Module } from '@nestjs/common';
import { AlertService } from './alert.service';

@Module({
  providers: [AlertService]
})
export class AlertModule {}
