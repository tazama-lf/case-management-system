import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';



export interface TaskComment {
  comment_id: string;
  user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
  case_id: string;
  task_id: string;
}

export interface CommentsByCaseId extends TaskComment {
  comments: TaskComment[];
}


export class CommentService {
  private baseUrl = '/api/v1/comment';

  async getCommentsByCaseId(caseId: string): Promise<CommentsByCaseId[]> {
    try {
      const response = await apiClient.get<CommentsByCaseId[]>(`${this.baseUrl}/case/${caseId}/comment`);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('CommentService: Failed to get tasks with comments for case:', caseId, error);
      throw this.handleError(error, 'get tasks with comments by case ID');
    }
  }

  async getCommentsByTaskId(taskId: string): Promise<CommentsByCaseId[]> {
    try {
      const response = await apiClient.get<CommentsByCaseId[]>(`${this.baseUrl}/task/${taskId}/comment`);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('CommentService: Failed to get tasks with comments for task:', taskId, error);
      throw this.handleError(error, 'get tasks with comments by task ID');
    }
  }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const commentService = new CommentService();