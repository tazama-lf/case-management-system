import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TriageService } from '../triage/triage.service';
import { TaskService } from '../task/task.service';
import { AlertMessageDto } from './dto/AlertMessageDto.dto';
import { StartupFactory } from '@tazama-lf/frms-coe-startup-lib';

@Injectable()
export class NatsStartupService implements OnModuleInit {
  private startupService: StartupFactory;

  constructor(
    private readonly triageService: TriageService,
    private readonly taskService: TaskService,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
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

  async handleMessage(req: AlertMessageDto) {
    const tenantId = req.transaction.TenantId ?? 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1';
    const systemId = this.configService.get<string>('SYSTEM_UUID') || 'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9';
    this.logger.log(`Request: ${JSON.stringify(req)}`, NatsStartupService.name);

    try {
      await this.triageService.processIncomingAlert(req, 'NATS', systemId, tenantId);
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
