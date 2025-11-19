import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { FlowableDefaults } from '../constants/flowable-api.constants';

/**
 * Factory service for creating and managing Flowable REST API client
 * Provides a singleton AxiosInstance with centralized configuration
 */
@Injectable()
export class FlowableClientFactory {
  private readonly client: AxiosInstance;
  private readonly flowableUrl: string;
  readonly tenantId = 'c950ac85-96f0-4390-8d94-5b8fdec4e863';

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

  /**
   * Get the configured Flowable API client
   * @returns AxiosInstance configured for Flowable REST API
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Get the Flowable base URL
   * @returns Flowable REST API base URL
   */
  getBaseUrl(): string {
    return this.flowableUrl;
  }
}
