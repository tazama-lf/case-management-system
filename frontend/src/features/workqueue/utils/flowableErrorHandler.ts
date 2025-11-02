import type { FlowableErrorResponse } from '../types/flowable.types';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';



export class FlowableError extends Error {
  public readonly type: 'FLOWABLE_ERROR' | 'API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  public readonly statusCode?: number;
  public readonly originalError?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    type: FlowableError['type'] = 'UNKNOWN_ERROR',
    statusCode?: number,
    originalError?: any
  ) {
    super(message);
    this.name = 'FlowableError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}


export const FlowableErrorCodes = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_ASSIGNED: 'TASK_ALREADY_ASSIGNED',
  TASK_ALREADY_COMPLETED: 'TASK_ALREADY_COMPLETED',
  TASK_SUSPENDED: 'TASK_SUSPENDED',
  INVALID_TASK_STATE: 'INVALID_TASK_STATE',

  ASSIGNEE_NOT_FOUND: 'ASSIGNEE_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_CANDIDATE_GROUP: 'INVALID_CANDIDATE_GROUP',

  PROCESS_NOT_FOUND: 'PROCESS_NOT_FOUND',
  PROCESS_DEFINITION_NOT_FOUND: 'PROCESS_DEFINITION_NOT_FOUND',
  INVALID_PROCESS_STATE: 'INVALID_PROCESS_STATE',

  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  FLOWABLE_SERVER_ERROR: 'FLOWABLE_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
} as const;

export type FlowableErrorCode = typeof FlowableErrorCodes[keyof typeof FlowableErrorCodes];


export const ErrorMessages: Record<FlowableErrorCode, string> = {
  [FlowableErrorCodes.TASK_NOT_FOUND]: 'The requested task could not be found. It may have been completed or deleted.',
  [FlowableErrorCodes.TASK_ALREADY_ASSIGNED]: 'This task is already assigned to another user.',
  [FlowableErrorCodes.TASK_ALREADY_COMPLETED]: 'This task has already been completed.',
  [FlowableErrorCodes.TASK_SUSPENDED]: 'This task is currently suspended and cannot be modified.',
  [FlowableErrorCodes.INVALID_TASK_STATE]: 'The task is in an invalid state for this operation.',

  [FlowableErrorCodes.ASSIGNEE_NOT_FOUND]: 'The specified user could not be found or is not available for assignment.',
  [FlowableErrorCodes.INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions to perform this action.',
  [FlowableErrorCodes.INVALID_CANDIDATE_GROUP]: 'The specified work queue or candidate group is not valid.',

  [FlowableErrorCodes.PROCESS_NOT_FOUND]: 'The process instance could not be found.',
  [FlowableErrorCodes.PROCESS_DEFINITION_NOT_FOUND]: 'The process definition could not be found.',
  [FlowableErrorCodes.INVALID_PROCESS_STATE]: 'The process is in an invalid state for this operation.',

  [FlowableErrorCodes.UNAUTHORIZED]: 'Authentication required. Please log in again.',
  [FlowableErrorCodes.FORBIDDEN]: 'You are not authorized to access this resource.',
  [FlowableErrorCodes.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',

  [FlowableErrorCodes.FLOWABLE_SERVER_ERROR]: 'The workflow engine is experiencing issues. Please try again later.',
  [FlowableErrorCodes.DATABASE_ERROR]: 'Database error occurred. Please contact support if the issue persists.',
  [FlowableErrorCodes.NETWORK_TIMEOUT]: 'Network timeout occurred. Please check your connection and try again.',
};


export class FlowableErrorHandler {

  static parseError(error: any, operation: string): FlowableError {
    console.error(`Flowable error during ${operation}:`, error);

    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return new FlowableError(
          ErrorMessages[FlowableErrorCodes.NETWORK_TIMEOUT],
          'NETWORK_ERROR',
          undefined,
          error
        );
      }
      return new FlowableError(
        `Network error: ${error.message || 'Connection failed'}`,
        'NETWORK_ERROR',
        undefined,
        error
      );
    }

    const { status, data } = error.response;

    if (FlowableErrorHandler.isFlowableError(data)) {
      const flowableError = data as FlowableErrorResponse;
      const errorCode = FlowableErrorHandler.mapFlowableErrorCode(flowableError, status);

      return new FlowableError(
        ErrorMessages[errorCode] || flowableError.message,
        'FLOWABLE_ERROR',
        status,
        flowableError
      );
    }

    if (FlowableErrorHandler.isApiError(data)) {
      const apiError = data as ApiErrorResponse;
      return new FlowableError(
        apiError.message || `Failed to ${operation}`,
        'API_ERROR',
        status,
        apiError
      );
    }

    return FlowableErrorHandler.createErrorFromStatus(status, operation, data);
  }


  private static mapFlowableErrorCode(error: FlowableErrorResponse, status: number): FlowableErrorCode {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('task') && message.includes('not found')) {
      return FlowableErrorCodes.TASK_NOT_FOUND;
    }
    if (message.includes('already assigned') || message.includes('task assigned')) {
      return FlowableErrorCodes.TASK_ALREADY_ASSIGNED;
    }
    if (message.includes('already completed') || message.includes('task completed')) {
      return FlowableErrorCodes.TASK_ALREADY_COMPLETED;
    }
    if (message.includes('suspended')) {
      return FlowableErrorCodes.TASK_SUSPENDED;
    }

    if (message.includes('assignee') && message.includes('not found')) {
      return FlowableErrorCodes.ASSIGNEE_NOT_FOUND;
    }
    if (message.includes('candidate group') || message.includes('invalid group')) {
      return FlowableErrorCodes.INVALID_CANDIDATE_GROUP;
    }

    if (status === 401) {
      return FlowableErrorCodes.UNAUTHORIZED;
    }
    if (status === 403) {
      return FlowableErrorCodes.FORBIDDEN;
    }

    if (message.includes('process') && message.includes('not found')) {
      return FlowableErrorCodes.PROCESS_NOT_FOUND;
    }

    if (status >= 500) {
      return FlowableErrorCodes.FLOWABLE_SERVER_ERROR;
    }

    if (status === 404) {
      return FlowableErrorCodes.TASK_NOT_FOUND;
    }

    return FlowableErrorCodes.FLOWABLE_SERVER_ERROR;
  }


  private static createErrorFromStatus(status: number, operation: string, data?: any): FlowableError {
    const statusErrorMap: Record<number, { message: string; type: FlowableError['type'] }> = {
      400: {
        message: `Invalid request: ${data?.message || 'Bad request'}`,
        type: 'API_ERROR',
      },
      401: {
        message: ErrorMessages[FlowableErrorCodes.UNAUTHORIZED],
        type: 'FLOWABLE_ERROR',
      },
      403: {
        message: ErrorMessages[FlowableErrorCodes.FORBIDDEN],
        type: 'FLOWABLE_ERROR',
      },
      404: {
        message: ErrorMessages[FlowableErrorCodes.TASK_NOT_FOUND],
        type: 'FLOWABLE_ERROR',
      },
      409: {
        message: 'Conflict: The resource is in a state that conflicts with the request',
        type: 'FLOWABLE_ERROR',
      },
    };

    // Handle server errors (500-504)
    if (status >= 500 && status <= 504) {
      return new FlowableError(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
        'FLOWABLE_ERROR',
        status,
        data
      );
    }

    const errorConfig = statusErrorMap[status];
    if (errorConfig) {
      return new FlowableError(
        errorConfig.message,
        errorConfig.type,
        status,
        data
      );
    }

    // Default fallback
    return new FlowableError(
      `Failed to ${operation}: HTTP ${status}`,
      'API_ERROR',
      status,
      data
    );
  }


  private static isFlowableError(error: any): error is FlowableErrorResponse {
    return error &&
           typeof error.message === 'string' &&
           typeof error.status === 'number' &&
           typeof error.error === 'string' &&
           typeof error.timestamp === 'string';
  }


  private static isApiError(error: any): error is ApiErrorResponse {
    return error && typeof error.message === 'string';
  }


  static getDisplayMessage(error: FlowableError): { message: string; canRetry: boolean; actionSuggestion?: string } {
    const canRetry = [
      'NETWORK_ERROR',
      'FLOWABLE_ERROR'
    ].includes(error.type) &&
    ![
      FlowableErrorCodes.UNAUTHORIZED,
      FlowableErrorCodes.FORBIDDEN,
      FlowableErrorCodes.TASK_NOT_FOUND,
      FlowableErrorCodes.TASK_ALREADY_COMPLETED
    ].includes(error.originalError?.errorCode);

    let actionSuggestion: string | undefined;

    if (error.type === 'NETWORK_ERROR') {
      actionSuggestion = 'Check your internet connection and try again.';
    } else if (error.statusCode === 401) {
      actionSuggestion = 'Please log in again to continue.';
    } else if (error.statusCode === 403) {
      actionSuggestion = 'Contact your supervisor for access to this resource.';
    }

    return {
      message: error.message,
      canRetry,
      actionSuggestion
    };
  }
}


export const createErrorMessage = (error: unknown, defaultMessage: string = 'An unexpected error occurred') => {
  if (error instanceof FlowableError) {
    return FlowableErrorHandler.getDisplayMessage(error);
  }

  if (error instanceof Error) {
    return {
      message: error.message || defaultMessage,
      canRetry: true
    };
  }

  return {
    message: defaultMessage,
    canRetry: true
  };
};