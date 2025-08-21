import { Test, TestingModule } from '@nestjs/testing';
import { NatsStartupService } from '../../src/nats/nats.startup';
import { TriageService } from '../../src/triage/triage.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

// Mock the NATS module to control connect/StringCodec behavior
jest.mock('nats', () => {
  return {
    StringCodec: () => ({
      decode: (v: any) => v, // pass-through for simplicity
    }),
    connect: jest.fn(),
  };
});

// Mock the NatsRelayPlugin class used inside the service
jest.mock('@tazama-lf/nats-relay-plugin', () => {
  return {
    __esModule: true,
    default: class MockRelay {
      init = jest.fn().mockResolvedValue(undefined);
      relay = jest.fn().mockResolvedValue(undefined);
    },
  };
});

// Build an async-iterable subscription helper
function createAsyncIterable(items: any[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const i of items) {
        yield i;
      }
    },
  } as any;
}

describe('NatsStartupService', () => {
  let service: NatsStartupService;
  let triageService: { handleNewAlert: jest.Mock };
  let logger: LoggerService;

  const setEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete (process.env as any)[name];
    else (process.env as any)[name] = value;
  };

  beforeEach(async () => {
    triageService = { handleNewAlert: jest.fn().mockResolvedValue(undefined) };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      logger: {} as any,
      lumberjackService: {} as any,
    } as unknown as LoggerService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStartupService,
        { provide: TriageService, useValue: triageService },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();

    service = module.get(NatsStartupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    setEnv('DESTINATION_TRANSPORT_URL', undefined);
    setEnv('CONSUMER_STREAM', undefined);
  });

  it('handleMessage: logs and returns on validation/missing fields', async () => {
    const badReq = { result: { transaction: {} } }; // missing tenantId and TxTp
    await service.handleMessage(badReq as any);
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid alert message received',
      expect.objectContaining({ missingFields: { tenantId: true, txTp: true } }),
    );
  });

  it('handleMessage: processes valid message and relays', async () => {
    const goodReq = {
      result: {
        tenant_id: 't1',
        message: 'ok',
        alert_data: { tadpResult: {} },
        transaction: { tenantId: 't1', TxTp: 'TT', userId: 'u1' },
        network_map: {},
        confidence_per: 95,
        userId: 'u1',
      },
    };

    await service.handleMessage(goodReq as any);

    expect(triageService.handleNewAlert).toHaveBeenCalled();
    // relay is inside the mocked plugin; just ensure no error path
    expect(logger.error).not.toHaveBeenCalledWith(
      'Failed to persist or publish alert',
      expect.anything(),
    );
  });

  it('onModuleInit: subscribes and handles messages (including JSON parse error)', async () => {
    const { connect } = require('nats');

    // Mock NATS connect() => { subscribe: returns async iterator }
    const messages = [
      // malformed JSON triggers catch block inside the for-await loop
      { data: 'not-json' },
    ];
    const nc = {
      subscribe: jest.fn().mockReturnValue(createAsyncIterable(messages)),
    };
    connect.mockResolvedValueOnce(nc);

    setEnv('DESTINATION_TRANSPORT_URL', 'nats://localhost:4222');
    setEnv('CONSUMER_STREAM', 'cms-test');

    // Spy on handleMessage so we can verify it is attempted after JSON.parse
    const handleSpy = jest.spyOn(service as any, 'handleMessage');

    await service.onModuleInit();

    // Let the async IIFE run
    await new Promise((r) => setTimeout(r, 10));

    // JSON parse fails; should not call handleMessage, but should log error
    expect(handleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Failed to process NATS message', expect.anything());
  });

  it('onModuleInit: uses default consumer stream when ENV unset and processes valid JSON', async () => {
    const { connect } = require('nats');

    // message that is valid JSON; our StringCodec.decode is identity
    const validPayload = JSON.stringify({ hello: 'world' });
    const messages = [{ data: validPayload }];

    const subscribe = jest.fn().mockReturnValue(createAsyncIterable(messages));
    const nc = { subscribe };
    connect.mockResolvedValueOnce(nc);

    // Do not set CONSUMER_STREAM to assert default 'cms'
    setEnv('DESTINATION_TRANSPORT_URL', 'nats://localhost:4222');
    setEnv('CONSUMER_STREAM', undefined);

    const handleSpy = jest.spyOn(service as any, 'handleMessage').mockResolvedValue(undefined);

    await service.onModuleInit();

    // Let async IIFE run
    await new Promise((r) => setTimeout(r, 10));

    expect(subscribe).toHaveBeenCalledWith('cms'); // default
    expect(handleSpy).toHaveBeenCalledWith(JSON.parse(validPayload));
    expect(logger.error).not.toHaveBeenCalledWith('Failed to process NATS message', expect.anything());
  });
});
