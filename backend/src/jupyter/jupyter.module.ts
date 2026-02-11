import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JupyterController } from './jupyter.controller';
import { JupyterService } from './jupyter.service';
import { JupyterProxyController } from './jupyter-proxy.controller';
import { JupyterProxyService } from './jupyter-proxy.service';
import { GoldLakehouseModule } from '../gold-lakehouse/gold-lakehouse.module';

@Module({
  imports: [ConfigModule, GoldLakehouseModule],
  controllers: [JupyterController, JupyterProxyController],
  providers: [JupyterService, JupyterProxyService],
  exports: [JupyterService, JupyterProxyService],
})
export class JupyterModule {}
