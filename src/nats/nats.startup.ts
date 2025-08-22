/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import NatsRelayPlugin from '@tazama-lf/nats-relay-plugin';
import { connect, StringCodec, Subscription } from 'nats';
import { TriageService } from '../triage/triage.service';
import { SubmitAlertDto } from '../triage/dto/submit-alert.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AlertMessageDto } from './dto/AlertMessageDto.dto';

@Injectable()
export class NatsStartupService implements OnModuleInit {
  private readonly natsRelay: NatsRelayPlugin;

  constructor(
    private readonly triageService: TriageService,
    private readonly logger: LoggerService,
  ) {
    this.natsRelay = new NatsRelayPlugin();
  }

  async onModuleInit() {
    await this.natsRelay.init(this.logger); // No APM needed
    this.logger.log('NATS Relay Plugin initialized');

    // Official NATS client subscription
    const natsUrl = process.env.DESTINATION_TRANSPORT_URL;
    const consumerStream = process.env.CONSUMER_STREAM || 'cms';
    const sc = StringCodec();
    const nc = await connect({ servers: natsUrl });
    this.logger.log(`Subscribed to NATS subject: ${consumerStream}`);
    const sub: Subscription = nc.subscribe(consumerStream);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = sc.decode(msg.data);
          this.logger.log('Received NATS message:', data);
          await this.handleMessage(JSON.parse(data));
        } catch (err) {
          console.log(err.message);
          this.logger.error('Failed to process NATS message', { error: err });
        }
      }
    })();
  }

  async handleMessage(req: Record<string, any>) {
    const alertDto = plainToInstance(AlertMessageDto, req);
    const errors = await validate(alertDto);

    const result = alertDto.result;
    const transaction = result.transaction as any;
    const tenantId = transaction?.tenantId;
    const txTp = transaction?.TxTp;
    const userId = result.userId ?? transaction?.userId ?? 'system';

    if (errors.length > 0 || !tenantId || !txTp) {
      this.logger.error('Invalid alert message received', {
        validationErrors: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
        missingFields: { tenantId: !tenantId, txTp: !txTp },
        originalPayload: req,
      });
      return;
    }

    this.logger.log(`Extracted txTp: ${txTp} for tenant: ${tenantId}`);

    try {
      const submitAlertDto: SubmitAlertDto = {
        result: {
          message: result.message,
          report: result.alert_data,
          transaction: result.transaction,
          networkMap: result.network_map,
        },
      };

      await this.triageService.handleNewAlert(submitAlertDto, userId, tenantId, 'NATS');
      this.logger.log(`Alert ingested from NATS for tenant: ${tenantId}`);

      // Publish alert to NATS
      await this.natsRelay.relay(JSON.stringify(submitAlertDto.result));
      this.logger.log('Alert published to NATS');
    } catch (err) {
      this.logger.error('Failed to persist or publish alert', {
        error: err instanceof Error ? err.message : err,
        tenantId,
        alertData: alertDto,
      });
    }
  }
}
