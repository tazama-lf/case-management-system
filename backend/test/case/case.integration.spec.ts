import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../.env.test') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TazamaAuthGuard } from '../../src/auth/tazama-auth.guard';
import { NatsStartupService } from '../../src/nats/nats.service';
import { FlowableService } from '../../src/flowable/flowable.service';

// Increase Jest timeout for this integration suite
jest.setTimeout(30000); // 30 seconds

describe('Case Management Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockNatsStartupService = {
      onModuleInit: jest.fn(),
      handleMessage: jest.fn().mockResolvedValue(undefined),
    };
    const mockFlowableService = {
      startProcessInstance: jest.fn().mockResolvedValue({ id: 'proc-1' }),
      getProcessTasks: jest.fn().mockResolvedValue([]),
      deployProcess: jest.fn().mockResolvedValue({}),
      deployBpmnProcesses: jest.fn().mockResolvedValue(undefined),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NatsStartupService)
      .useValue(mockNatsStartupService)
      .overrideProvider(FlowableService)
      .useValue(mockFlowableService)
      .overrideGuard(TazamaAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { token: 'mocked-token', sub: 'test-user' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  const basePayload = {
    tenantId: 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1',
    alertData: {},
    priority: 'NEW',
    caseType: 'FRAUD',
    confidencePercentage: 97,
  };

  it('/api/v1/cases/system-transmission (POST) should autoclose case for Money-Laundering', async () => {
    const payload = { ...basePayload, fraudType: 'Money-Laundering' };
    const response = await request(app.getHttpServer())
      .post('/api/v1/cases/system-transmission')
      .send(payload);
    if (response.status !== 201) {
      console.error('Test failed with status:', response.status);
      console.error('Response body:', response.body);
      if (response.body?.stack) {
        console.error('Error stack:', response.body.stack);
      }
      if (response.body?.message) {
        console.error('Error message:', response.body.message);
      }
    }
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('AUTOCLOSED_CONFIRMED_71');
  });

  it('/api/v1/cases/system-transmission (POST) should autoclose case for Fraud Only', async () => {
    const payload = { ...basePayload, fraudType: 'Fraud Only' };
    const response = await request(app.getHttpServer())
      .post('/api/v1/cases/system-transmission')
      .send(payload);
    if (response.status !== 201) {
      console.error('Test failed with status:', response.status);
      console.error('Response body:', response.body);
      if (response.body?.stack) {
        console.error('Error stack:', response.body.stack);
      }
      if (response.body?.message) {
        console.error('Error message:', response.body.message);
      }
    }
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('AUTOCLOSED_CONFIRMED_71');
  });

  it('/api/v1/cases/system-transmission (POST) should autoclose case for Transaction Blocked', async () => {
    const payload = { ...basePayload, fraudType: 'Transaction Blocked' };
    const response = await request(app.getHttpServer())
      .post('/api/v1/cases/system-transmission')
      .send(payload);
    if (response.status !== 201) {
      console.error('Test failed with status:', response.status);
      console.error('Response body:', response.body);
      if (response.body?.stack) {
        console.error('Error stack:', response.body.stack);
      }
      if (response.body?.message) {
        console.error('Error message:', response.body.message);
      }
    }
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('AUTOCLOSED_CONFIRMED_71');
  });

  it('/api/v1/cases/system-transmission (POST) should autoclose as refuted for other fraudType', async () => {
    const payload = { ...basePayload, fraudType: 'False Positive' };
    const response = await request(app.getHttpServer())
      .post('/api/v1/cases/system-transmission')
      .send(payload);
    if (response.status !== 201) {
      console.error('Test failed with status:', response.status);
      console.error('Response body:', response.body);
      if (response.body?.stack) {
        console.error('Error stack:', response.body.stack);
      }
      if (response.body?.message) {
        console.error('Error message:', response.body.message);
      }
    }
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('AUTOCLOSED_REFUTED_72');
  });

  // Add more integration tests for investigation flow, error cases, etc.

  afterAll(async () => {
    await app.close();
  });
});