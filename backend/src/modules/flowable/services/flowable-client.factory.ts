import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { FlowableDefaults } from '../../../constants/flowable-api.constants';

@Injectable()
export class FlowableClientFactory {
  private readonly client: AxiosInstance;
  private readonly flowableUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.flowableUrl = this.configService.get<string>('FLOWABLE_URL', 'http://10.10.80.30:8081/flowable-rest');

    const flowableAuth = {
      username: this.configService.get<string>('FLOWABLE_USERNAME', 'rest-admin'),
      password: this.configService.get<string>('FLOWABLE_PASSWORD', 'test'),
    };

    const timeoutMs = this.configService.get<number>('FLOWABLE_TIMEOUT_MS', FlowableDefaults.TIMEOUT_MS);

    this.client = axios.create({
      baseURL: this.flowableUrl,
      auth: flowableAuth,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  getBaseUrl(): string {
    return this.flowableUrl;
  }
}
