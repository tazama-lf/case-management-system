import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { DependencyHealthIndicator } from './dependency-health.indicator';

/**
 * Unauthenticated probe endpoints for load balancers, orchestrators and monitors. They report only up/down per
 * dependency, never connection details or error messages.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dependencies: DependencyHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe', description: 'Succeeds while the process can serve requests. Checks no dependencies.' })
  async live(): Promise<HealthCheckResult> {
    return await this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks Postgres, CouchDB, OpenSearch and Redis. Returns 503 if any is unreachable.',
  })
  async ready(): Promise<HealthCheckResult> {
    return await this.health.check([
      async () => await this.dependencies.postgres(),
      async () => await this.dependencies.couchdb(),
      async () => await this.dependencies.opensearch(),
      async () => await this.dependencies.redis(),
    ]);
  }
}
