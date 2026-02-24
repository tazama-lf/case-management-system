import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../auditLog.service';
import { AUDIT_LOG_OPTIONS_KEY, AuditLogOptions } from './audit-log.decorator';
import { extractUserData } from 'src/utils/helperFunction';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuditLogDecoratorInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditLogService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_OPTIONS_KEY,
      context.getHandler(),
    );

    // If the method is not decorated, just proceed without logging.
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    // We've merged the logic from AuditContextInterceptor here.
    // This assumes user information is attached to the request object by the auth guard.
    const { userId, fullName, role, tenantId } = extractUserData(request);
    const controller = context.getClass();
    const handler = context.getHandler();
    const controllerName = controller.name;
    const correlationId = randomUUID();
    
    // Phase 1: Log event initiation
    this.auditService.logAction({
      correlationId,
      eventType: options.eventType,
      sourceIp: request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip ?? 'UNKNOWN',
      description: options.description ?? '',
      eventPhase: 'INTENT',
      actorId: userId,
      actorName: fullName ?? '',
      actorRole: role,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      actionPerformed: {
        endpoint: request.url,
        method: request.method,
        body: request.body,
        controller: controllerName,
        ...(request.query ? { query: request.query } : {}),
        ...(request.params ? { params: request.params } : {}),
        ...options.actionPerformed,
      },
      tenantId: tenantId,
      outcome: {
        status: 'initiated',
        message: `Initiating ${options.eventType}`,
        ...options.outcome,
      },
    });

    return next.handle().pipe(
      tap(
        (data) => {
          // Phase 2: Log event success
          this.auditService.logAction({
            correlationId,
            eventType: options.eventType,
            sourceIp: request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip ?? 'UNKNOWN',
            description: options.description ?? '',
            eventPhase: 'SUCCESS',
            actorId: userId,
            actorName: fullName ?? '',
            actorRole: role,
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            actionPerformed: {
              endpoint: request.url,
              method: request.method,
              body: request.body,
              controller: controllerName,
              ...(request.query ? { query: request.query } : {}),
              ...(request.params ? { params: request.params } : {}),
              ...options.actionPerformed,
            },
            tenantId: tenantId,
            outcome: {
              status: 'success',
              message: `${options.eventType} completed successfully`,
              ...options.outcome,
            },
          });
        },
        (error) => {
          // Phase 3: Log event failure
          this.auditService.logAction({
            correlationId,
            eventType: options.eventType,
            sourceIp: request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip ?? 'UNKNOWN',
            description: options.description ?? '',
            eventPhase: 'FAILED',
            actorId: userId,
            actorName: fullName ?? '',
            actorRole: role,
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            actionPerformed: {
              endpoint: request.url,
              method: request.method,
              body: request.body,
              controller: controllerName,
              ...(request.query ? { query: request.query } : {}),
              ...(request.params ? { params: request.params } : {}),
              ...options.actionPerformed,
            },
            tenantId: tenantId,
            outcome: {
              status: 'failure',
              message: `${options.eventType} failed with error: ${error.message}`,
              ...options.outcome,
            },
          });
        },
      ),
    );
  }
}
