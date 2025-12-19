import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FlowableError,
  FlowableErrorHandler,
  FlowableErrorCodes,
  ErrorMessages,
  createErrorMessage,
} from '../flowableErrorHandler';
import type { FlowableErrorResponse } from '../../types/flowable.types';
import type { ApiErrorResponse } from '../../../alerts/types/triage.types';

describe('FlowableError', () => {
  it('creates error with default type', () => {
    const error = new FlowableError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('FlowableError');
    expect(error.type).toBe('UNKNOWN_ERROR');
    expect(error.statusCode).toBeUndefined();
    expect(error.originalError).toBeUndefined();
    expect(error.timestamp).toBeDefined();
    expect(new Date(error.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('creates error with all parameters', () => {
    const originalError = { code: 'TEST' };
    const error = new FlowableError(
      'Test error',
      'FLOWABLE_ERROR',
      404,
      originalError,
    );

    expect(error.message).toBe('Test error');
    expect(error.type).toBe('FLOWABLE_ERROR');
    expect(error.statusCode).toBe(404);
    expect(error.originalError).toBe(originalError);
  });

  it('has correct error name', () => {
    const error = new FlowableError('Test');
    expect(error.name).toBe('FlowableError');
  });
});

describe('FlowableErrorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('parseError', () => {
    it('handles network timeout errors', () => {
      const error = { code: 'ECONNABORTED' };
      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.NETWORK_TIMEOUT]);
      expect(result.originalError).toBe(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles timeout in error message', () => {
      const error = { message: 'Request timeout occurred' };
      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.NETWORK_TIMEOUT]);
    });

    it('handles network errors without response', () => {
      const error = { message: 'Connection failed' };
      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Network error: Connection failed');
      expect(result.originalError).toBe(error);
    });

    it('handles network errors without message', () => {
      const error = {};
      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Network error: Connection failed');
    });

    it('handles FlowableErrorResponse', () => {
      const flowableError = {
        message: 'Task not found in the system',
        error: 'TASK_NOT_FOUND',
        status: 404,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task/123',
      } as FlowableErrorResponse & { status: number };

      const error = {
        response: {
          status: 404,
          data: flowableError,
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'get task');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(404);
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.TASK_NOT_FOUND]);
      expect(result.originalError).toBe(flowableError);
    });

    it('handles FlowableErrorResponse with unmapped error code', () => {
      const flowableError = {
        message: 'Custom error message',
        error: 'CUSTOM_ERROR',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const error = {
        response: {
          status: 400,
          data: flowableError,
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
      );
    });

    it('handles ApiErrorResponse', () => {
      const apiError: ApiErrorResponse = {
        message: 'API error occurred',
        statusCode: 400,
        error: 'API_ERROR',
      };

      const error = {
        response: {
          status: 400,
          data: apiError,
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('API_ERROR');
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('API error occurred');
      expect(result.originalError).toBe(apiError);
    });

    it('handles ApiErrorResponse without message', () => {
      const apiError: ApiErrorResponse = {
        message: '',
        statusCode: 500,
        error: 'SERVER_ERROR',
      };

      const error = {
        response: {
          status: 500,
          data: apiError,
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'fetch data');

      expect(result.type).toBe('API_ERROR');
      expect(result.message).toBe('Failed to fetch data');
    });

    it('handles status 400 error', () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('API_ERROR');
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Bad request');
    });

    it('handles status 400 error without data message', () => {
      const error = {
        response: {
          status: 400,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('API_ERROR');
      expect(result.message).toBe('Invalid request: Bad request');
    });

    it('handles status 401 error', () => {
      const error = {
        response: {
          status: 401,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(401);
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.UNAUTHORIZED]);
    });

    it('handles status 403 error', () => {
      const error = {
        response: {
          status: 403,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(403);
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.FORBIDDEN]);
    });

    it('handles status 404 error', () => {
      const error = {
        response: {
          status: 404,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(404);
      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.TASK_NOT_FOUND]);
    });

    it('handles status 409 error', () => {
      const error = {
        response: {
          status: 409,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(409);
      expect(result.message).toBe(
        'Conflict: The resource is in a state that conflicts with the request',
      );
    });

    it('handles status 500 error', () => {
      const error = {
        response: {
          status: 500,
          data: { details: 'Server error' },
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
      );
      expect(result.originalError).toEqual({ details: 'Server error' });
    });

    it('handles status 502 error', () => {
      const error = {
        response: {
          status: 502,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(502);
      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
      );
    });

    it('handles status 504 error', () => {
      const error = {
        response: {
          status: 504,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('FLOWABLE_ERROR');
      expect(result.statusCode).toBe(504);
    });

    it('handles unknown status codes', () => {
      const error = {
        response: {
          status: 418,
          data: {},
        },
      };

      const result = FlowableErrorHandler.parseError(error, 'test operation');

      expect(result.type).toBe('API_ERROR');
      expect(result.statusCode).toBe(418);
      expect(result.message).toBe('Failed to test operation: HTTP 418');
    });
  });

  describe('mapFlowableErrorCode', () => {
    it('maps task not found message', () => {
      const error = {
        message: 'Task not found in database',
        error: 'ERROR',
        status: 404,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 404, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.TASK_NOT_FOUND]);
    });

    it('maps already assigned message', () => {
      const error = {
        message: 'Task already assigned to user',
        error: 'ERROR',
        status: 409,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 409, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.TASK_ALREADY_ASSIGNED],
      );
    });

    it('maps task assigned message', () => {
      const error = {
        message: 'The task assigned to another investigator',
        error: 'ERROR',
        status: 409,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 409, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.TASK_ALREADY_ASSIGNED],
      );
    });

    it('maps already completed message', () => {
      const error = {
        message: 'Task already completed by user',
        error: 'ERROR',
        status: 409,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 409, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.TASK_ALREADY_COMPLETED],
      );
    });

    it('maps task completed message', () => {
      const error = {
        message: 'The task completed successfully',
        error: 'ERROR',
        status: 409,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 409, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.TASK_ALREADY_COMPLETED],
      );
    });

    it('maps suspended message', () => {
      const error = {
        message: 'Task is suspended and cannot be modified',
        error: 'ERROR',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.TASK_SUSPENDED]);
    });

    it('maps assignee not found message', () => {
      const error = {
        message: 'Assignee not found in system',
        error: 'ERROR',
        status: 404,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 404, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.ASSIGNEE_NOT_FOUND],
      );
    });

    it('maps invalid candidate group message', () => {
      const error = {
        message: 'Invalid candidate group specified',
        error: 'ERROR',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.INVALID_CANDIDATE_GROUP],
      );
    });

    it('maps invalid group message', () => {
      const error = {
        message: 'The invalid group was provided',
        error: 'ERROR',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.INVALID_CANDIDATE_GROUP],
      );
    });

    it('maps process not found message', () => {
      const error = {
        message: 'Process not found in workflow',
        error: 'ERROR',
        status: 404,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/process',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 404, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.PROCESS_NOT_FOUND]);
    });

    it('maps status 401 to UNAUTHORIZED', () => {
      const error = {
        message: 'Some error',
        error: 'ERROR',
        status: 401,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 401, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.UNAUTHORIZED]);
    });

    it('maps status 403 to FORBIDDEN', () => {
      const error = {
        message: 'Some error',
        error: 'ERROR',
        status: 403,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 403, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.FORBIDDEN]);
    });

    it('maps status 500+ to FLOWABLE_SERVER_ERROR', () => {
      const error = {
        message: 'Server error',
        error: 'ERROR',
        status: 503,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 503, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
      );
    });

    it('maps status 404 to TASK_NOT_FOUND when no message match', () => {
      const error = {
        message: 'Resource not available',
        error: 'ERROR',
        status: 404,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 404, data: error } },
        'test',
      );

      expect(result.message).toBe(ErrorMessages[FlowableErrorCodes.TASK_NOT_FOUND]);
    });

    it('defaults to FLOWABLE_SERVER_ERROR for unmapped messages', () => {
      const error = {
        message: 'Unknown error occurred',
        error: 'ERROR',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.message).toBe(
        ErrorMessages[FlowableErrorCodes.FLOWABLE_SERVER_ERROR],
      );
    });
  });

  describe('isFlowableError', () => {
    it('identifies valid FlowableErrorResponse', () => {
      const error = {
        message: 'Error message',
        error: 'ERROR_TYPE',
        status: 400,
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      } as FlowableErrorResponse & { status: number };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('FLOWABLE_ERROR');
    });

    it('rejects invalid FlowableErrorResponse - missing message', () => {
      const error = {
        error: 'ERROR_TYPE',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });

    it('rejects invalid FlowableErrorResponse - missing status', () => {
      const error = {
        message: 'Error message',
        error: 'ERROR_TYPE',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });

    it('rejects invalid FlowableErrorResponse - missing error', () => {
      const error = {
        message: 'Error message',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/api/task',
      };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });

    it('rejects invalid FlowableErrorResponse - missing timestamp', () => {
      const error = {
        message: 'Error message',
        error: 'ERROR_TYPE',
        path: '/api/task',
      };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });

    it('rejects null error', () => {
      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: null } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });
  });

  describe('isApiError', () => {
    it('identifies valid ApiErrorResponse', () => {
      const error: ApiErrorResponse = {
        message: 'API error',
        statusCode: 400,
        error: 'API_ERROR',
      };

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });

    it('rejects error without message', () => {
      const error = {};

      const result = FlowableErrorHandler.parseError(
        { response: { status: 400, data: error } },
        'test',
      );

      expect(result.type).toBe('API_ERROR');
    });
  });

  describe('getDisplayMessage', () => {
    it('returns retryable message for NETWORK_ERROR', () => {
      const error = new FlowableError('Network error', 'NETWORK_ERROR');
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(true);
      expect(result.message).toBe('Network error');
      expect(result.actionSuggestion).toBe(
        'Check your internet connection and try again.',
      );
    });

    it('returns retryable message for FLOWABLE_ERROR without excluded codes', () => {
      const error = new FlowableError('Server error', 'FLOWABLE_ERROR', 500);
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(true);
      expect(result.message).toBe('Server error');
    });

    it('returns non-retryable message for UNAUTHORIZED', () => {
      const error = new FlowableError('Unauthorized', 'FLOWABLE_ERROR', 401, {
        errorCode: FlowableErrorCodes.UNAUTHORIZED,
      });
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
      expect(result.actionSuggestion).toBe('Please log in again to continue.');
    });

    it('returns non-retryable message for FORBIDDEN', () => {
      const error = new FlowableError('Forbidden', 'FLOWABLE_ERROR', 403, {
        errorCode: FlowableErrorCodes.FORBIDDEN,
      });
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
      expect(result.actionSuggestion).toBe(
        'Contact your supervisor for access to this resource.',
      );
    });

    it('returns non-retryable message for TASK_NOT_FOUND', () => {
      const error = new FlowableError('Not found', 'FLOWABLE_ERROR', 404, {
        errorCode: FlowableErrorCodes.TASK_NOT_FOUND,
      });
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
    });

    it('returns non-retryable message for TASK_ALREADY_COMPLETED', () => {
      const error = new FlowableError('Completed', 'FLOWABLE_ERROR', 409, {
        errorCode: FlowableErrorCodes.TASK_ALREADY_COMPLETED,
      });
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
    });

    it('returns non-retryable message for API_ERROR', () => {
      const error = new FlowableError('API error', 'API_ERROR', 400);
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
    });

    it('returns non-retryable message for UNKNOWN_ERROR', () => {
      const error = new FlowableError('Unknown error', 'UNKNOWN_ERROR');
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(false);
    });

    it('handles status 401 without errorCode', () => {
      const error = new FlowableError('Unauthorized', 'FLOWABLE_ERROR', 401);
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(true);
      expect(result.actionSuggestion).toBe('Please log in again to continue.');
    });

    it('handles status 403 without errorCode', () => {
      const error = new FlowableError('Forbidden', 'FLOWABLE_ERROR', 403);
      const result = FlowableErrorHandler.getDisplayMessage(error);

      expect(result.canRetry).toBe(true);
      expect(result.actionSuggestion).toBe(
        'Contact your supervisor for access to this resource.',
      );
    });
  });

  describe('createErrorMessage', () => {
    it('handles FlowableError instance', () => {
      const error = new FlowableError('Flowable error', 'FLOWABLE_ERROR', 500);
      const result = createErrorMessage(error);

      expect(result.message).toBe('Flowable error');
      expect(result.canRetry).toBe(true);
    });

    it('handles Error instance with message', () => {
      const error = new Error('Standard error');
      const result = createErrorMessage(error);

      expect(result.message).toBe('Standard error');
      expect(result.canRetry).toBe(true);
    });

    it('handles Error instance without message', () => {
      const error = new Error('');
      const result = createErrorMessage(error, 'Default message');

      expect(result.message).toBe('Default message');
      expect(result.canRetry).toBe(true);
    });

    it('handles unknown error type with default message', () => {
      const error = { someProperty: 'value' };
      const result = createErrorMessage(error, 'Default message');

      expect(result.message).toBe('Default message');
      expect(result.canRetry).toBe(true);
    });

    it('uses default message when not provided', () => {
      const error = { someProperty: 'value' };
      const result = createErrorMessage(error);

      expect(result.message).toBe('An unexpected error occurred');
      expect(result.canRetry).toBe(true);
    });
  });
});

