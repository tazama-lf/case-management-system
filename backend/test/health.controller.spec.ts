import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import axios from 'axios';
import { HealthController } from '../src/modules/health/health.controller';
import { DependencyHealthIndicator } from '../src/modules/health/dependency-health.indicator';
import { PrismaService } from '../prisma/prisma.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { RedisService } from '../src/modules/shared/redis.service';

jest.mock('axios');

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };
  const info = jest.fn();
  const couch = { getDatabase: () => ({ info }) };
  const ping = jest.fn();
  const redis = { getClient: jest.fn() };
  const config = { get: jest.fn(), getOrThrow: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    config.get.mockReturnValue('false');
    config.getOrThrow.mockImplementation((key: string) => (key === 'OPENSEARCH_NODE' ? 'http://os:9200' : 'x'));
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    info.mockResolvedValue({});
    ping.mockResolvedValue('PONG');
    redis.getClient.mockReturnValue({ ping });
    (axios.get as jest.Mock).mockResolvedValue({ data: { status: 'green' } });

    // A fresh indicator per test, so its result cache cannot leak between tests.
    const module = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        DependencyHealthIndicator,
        { provide: PrismaService, useValue: prisma },
        { provide: CouchdbService, useValue: couch },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    controller = module.get(HealthController);
  });

  it('live reports ok without checking dependencies', async () => {
    await expect(controller.live()).resolves.toMatchObject({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('ready reports ok when all dependencies are up', async () => {
    const result = await controller.ready();
    expect(result.status).toBe('ok');
    expect(Object.keys(result.info ?? {})).toEqual(['postgres', 'couchdb', 'opensearch', 'redis']);
  });

  it('ready fails with 503 when postgres is down, without leaking the error', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'));
    const error = await controller.ready().catch((e: unknown) => e);
    expect((error as { getStatus: () => number }).getStatus()).toBe(503);
    expect(JSON.stringify((error as { getResponse: () => unknown }).getResponse())).not.toContain('10.0.0.1');
  });

  it('ready fails when the opensearch cluster is red', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { status: 'red' } });
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });

  it('ready fails when redis is not connected', async () => {
    redis.getClient.mockReturnValue(null);
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });

  it('ready fails when redis ping fails', async () => {
    ping.mockRejectedValue(new Error('Connection is closed.'));
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });
});
