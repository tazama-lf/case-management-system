import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JupyterService } from './jupyter.service';
import { JupyterProxyController } from './jupyter-proxy.controller';
import { JupyterProxyService } from './jupyter-proxy.service';
import { GoldLakehouseModule } from '../gold-lakehouse/gold-lakehouse.module';

@Module({
  imports: [ConfigModule, GoldLakehouseModule],
  controllers: [JupyterProxyController],
  providers: [JupyterService, JupyterProxyService],
  exports: [JupyterService, JupyterProxyService],
})
export class JupyterModule { }
