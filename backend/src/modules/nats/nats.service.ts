import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { StartupFactory } from '@tazama-lf/frms-coe-startup-lib';
import { ProcessAlertService } from '../process-alert/process-alert.service';
import { IngestAlertDto } from 'src/modules/alert/dto';

@Injectable()
export class NatsStartupService implements OnModuleInit {
  private startupService: StartupFactory;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
    private readonly processAlertService: ProcessAlertService,
  ) {}

  async onModuleInit() {
    try {
      const { StartupFactory } = await import('@tazama-lf/frms-coe-startup-lib');
      this.startupService = new StartupFactory();
      this.logger.log('NATS Relay Plugin initialized', NatsStartupService.name);
      await this.startupService.init(this.handleMessage.bind(this), this.logger);
    } catch (error) {
      this.logger.error(`Failed to initialize NATS Relay Plugin : ${error.message}`, NatsStartupService.name);
      throw error as Error;
    }
  }

  async handleMessage(req: IngestAlertDto) {
    const tenantId = req.transaction.TenantId ?? 'DEFAULT';
    const systemId = this.configService.get<string>('SYSTEM_UUID') || 'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9';
    this.logger.log(`Request: ${JSON.stringify(req)}`, NatsStartupService.name);

    try {
      await this.processAlertService.processIncomingAlert(req, 'NATS', systemId, tenantId);
      this.logger.log(`Alert ingested from NATS for tenant: ${tenantId}`, NatsStartupService.name);
    } catch (err) {
      this.logger.error(
        `Failed to persist or publish alert | error=${err instanceof Error ? err.message : err} | tenantId=${tenantId} | alertData=${JSON.stringify(req.report)}`,
        err instanceof Error ? err.stack : undefined,
        NatsStartupService.name,
      );
    }
  }
}
