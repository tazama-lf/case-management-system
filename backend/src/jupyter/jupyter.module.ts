import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JupyterController } from './jupyter.controller';
import { JupyterService } from './jupyter.service';

@Module({
  imports: [ConfigModule],
  controllers: [JupyterController],
  providers: [JupyterService],
  exports: [JupyterService],
})
export class JupyterModule {}
