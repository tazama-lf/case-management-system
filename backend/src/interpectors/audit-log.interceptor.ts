import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { type IAuditService, type IAuditLogInput, EventPhase } from '@tazama-lf/audit-lib';
import type { Request } from 'express';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { extractUserData } from 'src/utils/helperFunction';
import { IAuditLogBaseDto } from '../modules/audit/dto/audit-log.dto';

/**
 * Audit interceptor for logging critical user actions
 * Implements fire-and-forget pattern to ensure audit failures don't block operations
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@Inject('AUDIT_LOGGER') private readonly auditService: IAuditService) {}

  /**
   * Intercepts HTTP requests to critical endpoints and logs audit information
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const authenticatedRequest = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const startTime = Date.now();
    const correlationId = randomUUID();
    const baseAuditData = this.buildBaseAuditData(context, authenticatedRequest);

    this.logAuditAsync({ ...baseAuditData, outcome: {} }, EventPhase.INTENT, correlationId);

    const { method } = authenticatedRequest;

    return next.handle().pipe(
      tap((responseData) => {
        const isModifyingRequest = method === 'PUT' || method === 'PATCH';
        const outcome = {
          executionTimeMs: Date.now() - startTime,
          responseSize: JSON.stringify(responseData ?? {}).length,
          ...(isModifyingRequest ? this.sanitizeData(responseData, ['password', 'token', 'secret', 'accessToken', 'refreshToken']) : {}),
        };
        this.logAuditAsync(
          {
            ...baseAuditData,
            resourceId: this.extractResourceIdFromResponse(responseData) ?? baseAuditData.resourceId,
            outcome,
          },
          EventPhase.SUCCESS,
          correlationId,
        );
      }),
      catchError((error) => {
        const outcome = {
          error: error.message,
          statusCode: error.status ?? 500,
          executionTimeMs: Date.now() - startTime,
        };

        this.logAuditAsync({ ...baseAuditData, outcome }, EventPhase.FAILED, correlationId);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Builds the base audit data from request context
   * @private
   */
  private buildBaseAuditData(
    context: ExecutionContext,
    request: AuthenticatedRequest,
  ): Omit<IAuditLogInput, 'outcome' | 'correlationId' | 'eventPhase'> {
    const { method, url, body, params, query, headers } = request;
    const userData = extractUserData(request);
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const { description, eventType } = this.createDescriptionAndEventType(method, url, handler);

    return {
      actorId: userData.userId,
      actorRole: userData.role,
      actorName: userData.fullName ?? 'Anonymous User',
      resourceId: this.extractResourceIdFromRequest(request),
      resourceType: this.mapControllerToResourceType(controller),
      sourceIp: this.extractSourceIp(request),
      description,
      eventType,
      tenantId: userData.tenantId,
      actionPerformed: {
        method,
        endpoint: url,
        handler,
        controller,
        userAgent: headers['user-agent'],
        ...(method === 'PUT' || method === 'PATCH'
          ? { requestBody: this.sanitizeData(body, ['password', 'token', 'secret', 'key', 'auth', 'credential']) }
          : {}),
        pathParameters: params,
        queryParameters: query,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Extracts resource ID from request parameters
   * @private
   */
  private extractResourceIdFromRequest(request: Record<string, any>): string | undefined {
    const { params, body } = request;
    return (
      params.caseId ?? params.taskId ?? params.id ?? params.alertId ?? params.roleName ?? params.systemName ?? params.changeId ?? body?.txtp
    );
  }

  /**
   * Extracts resource ID from response data
   * @private
   */
  private extractResourceIdFromResponse(responseData: any): string | undefined {
    if (!responseData || typeof responseData !== 'object') return undefined;
    return responseData.caseId ?? responseData.taskId ?? responseData.id ?? responseData._id ?? responseData.alert_id ?? responseData.txtp;
  }

  /**
   * Maps controller class names to resource types
   * @private
   */
  private mapControllerToResourceType(controllerName: string): string {
    const resourceMapping: Record<string, string> = {
      AdminController: 'admin',
      AlertController: 'alert',
      AlertPriorityController: 'alert-priority',
      AuthController: 'auth',
      CaseController: 'case',
      TaskController: 'task',
      CommentController: 'comment',
      NotificationController: 'notification',
      EvidenceController: 'evidence',
      EventLogController: 'event-log',
      EventController: 'event',
      ConfigManagementController: 'configuration',
      UserController: 'user',
      DwhController: 'dwh',
      ReportsController: 'report',
      TriageController: 'triage',
      TaskHistoryController: 'task-history',
      CaseHistoryController: 'case-history',
      FilterController: 'filter',
      ProcessAlertController: 'process-alert',
    };

    return resourceMapping[controllerName] ?? 'unknown';
  }

  /**
   * Extracts the real client IP address
   * @private
   */
  private extractSourceIp(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'] as string;
    const xRealIp = request.headers['x-real-ip'] as string;
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    if (xRealIp) {
      return xRealIp;
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Builds human-readable description of the action
   * @private
   */
  private createDescriptionAndEventType(method: string, url: string, handler: string): { description: string; eventType: string } {
    const actionMap: Record<string, { description: string; eventType: string }> = {
      login: {
        description: 'User authentication attempt',
        eventType: 'LOGIN',
      },
      registerReferenceId: {
        description: 'Created new reference ID',
        eventType: 'CREATE_REFERENCE_ID',
      },
      createCaseManually: {
        description: 'Manually created case',
        eventType: 'CREATE_CASE_MANUALLY',
      },
      closeCase: {
        description: 'Closed case',
        eventType: 'CLOSE_CASE',
      },
      updateCase: {
        description: 'Updated case details',
        eventType: 'UPDATE_CASE_DETAILS',
      },
      completeCaseCreation: {
        description: 'Completed case creation',
        eventType: 'COMPLETE_CASE_CREATION',
      },
      approveCaseClosure: {
        description: 'Case is approved for closure',
        eventType: 'APPROVE_CASE_CLOSURE',
      },
      rejectCaseClosure: {
        description: 'Case closure is rejected',
        eventType: 'REJECT_CASE_CLOSURE',
      },
      approveCaseCreation: {
        description: 'Case is approved for creation',
        eventType: 'APPROVE_CASE_CREATION',
      },
      rejectCaseCreation: {
        description: 'Case creation is rejected',
        eventType: 'REJECT_CASE_CREATION',
      },
      approveCaseReopening: {
        description: 'Case is approved for reopening',
        eventType: 'APPROVE_CASE_REOPENING',
      },
      rejectCaseReopening: {
        description: 'Case reopening is rejected',
        eventType: 'REJECT_CASE_REOPENING',
      },
      returnCaseForReview: {
        description: 'Returned case for review',
        eventType: 'RETURN_CASE_FOR_REVIEW',
      },
      saveCaseAsDraft: {
        description: 'Saved case as draft',
        eventType: 'SAVE_CASE_AS_DRAFT',
      },
      abandonCase: {
        description: 'Abandoned case',
        eventType: 'ABANDON_CASE',
      },
      reopenCase: {
        description: 'Reopened case',
        eventType: 'REOPEN_CASE',
      },
      suspendCase: {
        description: 'Suspended case',
        eventType: 'SUSPEND_CASE',
      },
      resumeCase: {
        description: 'Resumed case',
        eventType: 'RESUME_CASE',
      },
      completeCase: {
        description: 'Completed case',
        eventType: 'COMPLETE_CASE',
      },
      addComment: {
        description: 'Comment is added',
        eventType: 'ADD_COMMENT',
      },
      testIntegration: {
        description: 'Integration is tested',
        eventType: 'TEST_INTEGRATION',
      },
      verify2FA: {
        description: '2FA is verified',
        eventType: 'VERIFY_2FA',
      },
      configureRole: {
        description: 'Role is configured',
        eventType: 'CONFIGURE_ROLE',
      },
      configureIntegration: {
        description: 'Configured integration',
        eventType: 'CONFIGURE_INTEGRATION',
      },
      deleteEvidence: {
        description: 'Deleted evidence',
        eventType: 'DELETE_EVIDENCE',
      },
      uploadEvidence: {
        description: 'Uploaded evidence',
        eventType: 'UPLOAD_EVIDENCE',
      },
      createFilter: {
        description: 'Created filter',
        eventType: 'CREATE_FILTER',
      },
      updateUserPreferences: {
        description: 'Updated user preferences',
        eventType: 'UPDATE_USER_PREFERENCES',
      },
      processIncomingAlert: {
        description: 'Processed incoming alert',
        eventType: 'PROCESS_INCOMING_ALERT',
      },
      generateFraudReport: {
        description: 'Generated fraud report',
        eventType: 'GENERATE_FRAUD_REPORT',
      },
      editFraudReport: {
        description: 'Edited fraud report',
        eventType: 'EDIT_FRAUD_REPORT',
      },
      approveFraudReport: {
        description: 'Approved fraud report',
        eventType: 'APPROVE_FRAUD_REPORT',
      },
      createTask: {
        description: 'Task is created',
        eventType: 'CREATE_TASK',
      },
      unassignTask: {
        description: 'Task is unassigned',
        eventType: 'UNASSIGN_TASK',
      },
      assignTaskToInvestigator: {
        description: 'Task is assigned to investigator',
        eventType: 'ASSIGN_TASK_TO_INVESTIGATOR',
      },
      updateTask: {
        description: 'Task is updated',
        eventType: 'UPDATE_TASK',
      },
      reassignTask: {
        description: 'Task is reassigned',
        eventType: 'REASSIGN_TASK',
      },
      generateProfile: {
        description: 'Profile is generated',
        eventType: 'GENERATE_PROFILE',
      },
      manualTriage: {
        description: 'Manual triage is performed',
        eventType: 'MANUAL_TRIAGE',
      },
      downloadEvidence: {
        description: 'Evidence is downloaded',
        eventType: 'DOWNLOAD_EVIDENCE',
      },
    };

    return actionMap[handler] ?? { description: `${method} ${url}`, eventType: handler.toUpperCase() };
  }
  /**
   * Sanitizes data by removing sensitive fields and truncating large payloads
   * @private
   */
  private sanitizeData(data: any, sensitiveFields: string[]): any {
    if (!data || typeof data !== 'object') return data;

    const cleanData = { ...data };
    sensitiveFields.forEach((field) => {
      Reflect.deleteProperty(cleanData, field);
    });

    const serialized = JSON.stringify(cleanData);
    return serialized.length > 10000 ? { _truncated: true, _originalSize: serialized.length } : cleanData;
  }
  /**
   * Logs audit data asynchronously without blocking the main operation
   * @private
   */
  private logAuditAsync(auditData: IAuditLogBaseDto, eventPhase: EventPhase, correlationId: string): void {
    this.auditService.log({ ...auditData, correlationId, eventPhase }).catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Audit logging failed for ${auditData.eventType} by ${auditData.actorName}`, {
        error: errorMessage,
        stack: errorStack,
        auditData: {
          eventType: auditData.eventType,
          actorId: auditData.actorId,
          resourceType: auditData.resourceType,
          resourceId: auditData.resourceId,
        },
      });
    });
  }
}
