import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TriageService } from '../triage/triage.service';
import { AlertMessageDto } from './dto/AlertMessageDto.dto';
import { StartupFactory } from '@tazama-lf/frms-coe-startup-lib';

@Injectable()
export class NatsStartupService implements OnModuleInit {
  private startupService: StartupFactory;

  constructor(
    private readonly triageService: TriageService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    try {
      const { StartupFactory } = await import('@tazama-lf/frms-coe-startup-lib');
      this.startupService = new StartupFactory();
      this.logger.log('NATS Relay Plugin initialized');
      await this.startupService.init(this.handleMessage.bind(this), this.logger);
    } catch (error) {
      this.logger.error('Failed to initialize NATS Relay Plugin', { error });
      throw error as Error;
    }
  }

  async handleMessage(req: AlertMessageDto) {
    const tenantId = req.transaction.TenantId ?? 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1';

    this.logger.log(`Request: ${JSON.stringify(req)}`, 'NatsStartupService');

    try {
      await this.triageService.handleNewAlert(req, 'SYSTEM', tenantId, 'NATS');
      this.logger.log(`Alert ingested from NATS for tenant: ${tenantId}`);

      this.logger.log('Alert published to NATS');
    } catch (err) {
      this.logger.error('Failed to persist or publish alert', {
        error: err instanceof Error ? err.message : err,
        tenantId,
        alertData: req.report,
      });
    }
  }
}
