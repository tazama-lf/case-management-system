import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JupyterService } from './jupyter.service';
import { JupyterProxyController } from './jupyter-proxy.controller';
import { JupyterProxyService } from './jupyter-proxy.service';
import { GoldLakehouseModule } from '../gold-lakehouse/gold-lakehouse.module';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [ConfigModule, GoldLakehouseModule, AuthModule, SharedModule],
  controllers: [JupyterProxyController],
  providers: [JupyterService, JupyterProxyService],
  exports: [JupyterService, JupyterProxyService],
})
export class JupyterModule {}
