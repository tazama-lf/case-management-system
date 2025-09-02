import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TriageService } from '../triage/triage.service';
import { TaskService } from '../task/task.service';
import { AlertMessageDto } from './dto/AlertMessageDto.dto';
import { StartupFactory } from '@tazama-lf/frms-coe-startup-lib';
import { SubmitAlertDto } from 'src/triage/dto/submit-alert.dto';
import { TaskStatus } from '@prisma/client';

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
      const { StartupFactory } = await import(
        '@tazama-lf/frms-coe-startup-lib'
      );
      this.startupService = new StartupFactory();
      this.logger.log('NATS Relay Plugin initialized', NatsStartupService.name);
      await this.startupService.init(
        this.handleMessage.bind(this),
        this.logger,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize NATS Relay Plugin : ${error.message}`,
        NatsStartupService.name,
      );
      throw error as Error;
    }
  }

  async handleMessage(req: AlertMessageDto) {
    const tenantId =
      req.transaction.TenantId ?? 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1';
    const systemId =
      this.configService.get<string>('SYSTEM_UUID') ||
      'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9';

    this.logger.log(`Request: ${JSON.stringify(req)}`, NatsStartupService.name);

    try {
      const submitAlertDto: SubmitAlertDto = {
        message: req.message,
        report: req.report,
        transaction: req.transaction,
        networkMap: req.networkMap,
      };

      const alert = await this.triageService.handleNewAlert(
        submitAlertDto,
        systemId,
        tenantId,
        'NATS',
      );
      const aiTriageEnabled =
        this.configService
          .get<string>('AI_TRIAGE_ENABLED', 'false')
          .toLowerCase() === 'true';
      if (aiTriageEnabled) {
        this.logger.log(
          `AI Triage enabled doing ai triage on: ${alert.alert_id}`,
          NatsStartupService.name,
        );
        await this.triageService.handleAITriage(
          alert.alert_id,
          alert.case_id,
          submitAlertDto,
          systemId,
          tenantId,
        );
      } else {
        this.logger.log(
          `AI Triage disabled creating manual investiation task for alert: ${alert.alert_id}`,
          NatsStartupService.name,
        );
        await this.taskService.createTask(
          {
            caseId: alert.case_id,
            assignedUserId: systemId,
            status: TaskStatus.ASSIGNED_10,
            name: 'Investigate case',
            description: `Task to investigate: ${alert.case_id}`,
          },
          systemId,
        );
      }
      this.logger.log(
        `Alert ingested from NATS for tenant: ${tenantId}`,
        NatsStartupService.name,
      );
    } catch (err) {
      this.logger.error(
        `Failed to persist or publish alert | error=${err instanceof Error ? err.message : err} | tenantId=${tenantId} | alertData=${JSON.stringify(req.report)}`,
        err instanceof Error ? err.stack : undefined,
        NatsStartupService.name,
      );
    }
  }
}
