import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import axios from 'axios';
import https from 'node:https';
import { PrismaService } from '../../../prisma/prisma.service';
import { CouchdbService } from '../couchdb/couchdb.service';
import { RedisService } from '../shared/redis.service';

const CHECK_TIMEOUT_MS = 3000;
// Probes are polled frequently; share one result between concurrent and back-to-back requests.
const CACHE_TTL_MS = 2000;

@Injectable()
export class DependencyHealthIndicator {
  private readonly logger = new Logger(DependencyHealthIndicator.name);
  private readonly cache = new Map<string, { result: Promise<HealthIndicatorResult>; expiresAt: number }>();

  constructor(
    private readonly indicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly couchdbService: CouchdbService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async postgres(): Promise<HealthIndicatorResult> {
    return await this.probe('postgres', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
    });
  }

  async couchdb(): Promise<HealthIndicatorResult> {
    return await this.probe('couchdb', async () => {
      await this.couchdbService.getDatabase().info();
    });
  }

  async redis(): Promise<HealthIndicatorResult> {
    return await this.probe('redis', async () => {
      const client = this.redisService.getClient();
      if (client === null) {
        throw new Error('client is not connected');
      }
      await client.ping();
    });
  }

  async opensearch(): Promise<HealthIndicatorResult> {
    const node = this.configService.getOrThrow<string>('OPENSEARCH_NODE');
    const rejectUnauthorized = this.configService.get<string>('OPENSEARCH_SSL_REJECT_UNAUTHORIZED') !== 'false';

    return await this.probe('opensearch', async (signal) => {
      const { data } = await axios.get<{ status?: string }>(new URL('/_cluster/health', node).toString(), {
        auth: {
          username: this.configService.getOrThrow<string>('OPENSEARCH_USERNAME'),
          password: this.configService.getOrThrow<string>('OPENSEARCH_PASSWORD'),
        },
        httpsAgent: new https.Agent({ rejectUnauthorized }),
        timeout: CHECK_TIMEOUT_MS,
        signal,
      });
      // A red cluster has unassigned primary shards: reads and writes to those indices fail.
      if (data.status === 'red') {
        throw new Error('cluster status is red');
      }
    });
  }

  private async probe(key: string, fn: (signal: AbortSignal) => Promise<void>): Promise<HealthIndicatorResult> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return await cached.result;
    }
    const result = this.run(key, fn);
    this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return await result;
  }

  private async run(key: string, fn: (signal: AbortSignal) => Promise<void>): Promise<HealthIndicatorResult> {
    const session = this.indicatorService.check(key);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, CHECK_TIMEOUT_MS);
    try {
      await Promise.race([
        fn(controller.signal),
        // eslint-disable-next-line promise/avoid-new -- no promise API turns an AbortSignal into a rejection
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`));
          });
        }),
      ]);
      return session.up();
    } catch (error) {
      // Detail goes to the log only; the response must not leak hosts or credentials.
      this.logger.warn(`Readiness check failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return session.down();
    } finally {
      clearTimeout(timer);
    }
  }
}
