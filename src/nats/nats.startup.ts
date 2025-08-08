import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  StartupFactory,
  IStartupService,
} from '@tazama-lf/frms-coe-startup-lib';
import { TriageService } from '../triage/triage.service';
import { SubmitAlertDto } from '../triage/dto/submit-alert.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AlertMessageDto } from './dto/AlertMessageDto.dto';

@Injectable()
export class NatsStartupService implements OnModuleInit {
  private readonly logger = new Logger(NatsStartupService.name);
  private server: IStartupService;

  constructor(private readonly triageService: TriageService) {}

  async onModuleInit() {
    this.server = new StartupFactory();
    await this.server.init(this.handleMessage.bind(this), this.logger);
    this.logger.log('NATS Startup Service initialized');
  }

  async handleMessage(req: Record<string, any>) {
    const alertDto = plainToInstance(AlertMessageDto, req);
    const errors = await validate(alertDto);

    // Extract tenantId and txTp from the transaction object
    const transaction = alertDto.transaction as any;
    const tenantId = transaction?.tenantId;
    const txTp = transaction?.TxTp;

    // Validate presence and format
    if (
      errors.length > 0 ||
      !tenantId ||
      typeof tenantId !== 'string' ||
      !txTp ||
      typeof txTp !== 'string'
    ) {
      this.logger.error('Invalid alert message received', {
        validationErrors: errors.map((e) => ({
          property: e.property,
          constraints: e.constraints,
        })),

        missingFields: {
          tenantId: !tenantId,
          txTp: !txTp,
        },
        originalPayload: req,
      });
      return;
    }

    this.logger.log(
      `Extracted txtp: ${txTp} from transaction for tenant: ${tenantId}`,
    );

    try {
      const submitAlertDto: SubmitAlertDto = {
        result: {
          message: alertDto.message,
          report: alertDto.alert_data,
          transaction: alertDto.transaction,
          networkMap: alertDto.network_map,
        },
      };

      // Set source and txtp explicitly from NATS extraction
      (submitAlertDto.result as any).source = 'nats';
      (submitAlertDto.result as any).txtp = txTp;

      await this.triageService.handleNewAlert(submitAlertDto, 'nats', tenantId);
      this.logger.log(`Alert ingested from NATS for tenant: ${tenantId}`);
    } catch (err) {
      this.logger.error('Failed to persist alert', {
        error: err instanceof Error ? err.message : err,
        tenantId,
        alertData: alertDto,
      });
    }
  }
}
