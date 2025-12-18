import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';



export interface TaskComment {
  comment_id: number;
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

export interface CreateCommentDto {
  note: string;
  caseId?: string;
  taskId?: string;
}

export class CommentService {
  private baseUrl = '/api/v1/comment';

  async getCommentsByCaseId(caseId: number): Promise<CommentsByCaseId[]> {
    try {
      const response = await apiClient.get<CommentsByCaseId[]>(`${this.baseUrl}/case/${caseId}/comment`);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('CommentService: Failed to get tasks with comments for case:', caseId, error);
      throw this.handleError(error, 'get tasks with comments by case ID');
    }
  }

  async getCommentsByTaskId(taskId: number): Promise<CommentsByCaseId[]> {
    try {
      const response = await apiClient.get<CommentsByCaseId[]>(`${this.baseUrl}/task/${taskId}/comment`);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('CommentService: Failed to get tasks with comments for task:', taskId, error);
      throw this.handleError(error, 'get tasks with comments by task ID');
    }
  }

  async addComment(dto: CreateCommentDto): Promise<TaskComment> {
    try {
      const response = await apiClient.post<TaskComment>(this.baseUrl, dto);
      return response;
    } catch (error: unknown) {
      console.error('CommentService: Failed to add comment:', error);
      const message = error instanceof Error ? error.message : 'Failed to add comment';
      throw new Error(message);
    }
  }


  async getComment(commentId: number): Promise<TaskComment> {
    try {
      const response = await apiClient.get<TaskComment>(`${this.baseUrl}/${commentId}`);
      return response;
    } catch (error: unknown) {
      console.error('CommentService: Failed to get comment:', error);
      const message = error instanceof Error ? error.message : 'Failed to get comment';
      throw new Error(message);
    }
  }


  async getCommentsByCase(caseId: number): Promise<TaskComment[]> {
    try {
      const response = await apiClient.get<TaskComment[]>(`${this.baseUrl}?caseId=${caseId}`);
      return Array.isArray(response) ? response : [];
    } catch (error: unknown) {
      console.error('CommentService: Failed to get comments by case:', error);
      const message = error instanceof Error ? error.message : 'Failed to get comments';
      throw new Error(message);
    }
  }

  /**
   * Get all comments for a task
   */
  async getCommentsByTask(taskId: number): Promise<TaskComment[]> {
    try {
      const response = await apiClient.get<TaskComment[]>(`${this.baseUrl}?taskId=${taskId}`);
      return Array.isArray(response) ? response : [];
    } catch (error: unknown) {
      console.error('CommentService: Failed to get comments by task:', error);
      const message = error instanceof Error ? error.message : 'Failed to get comments';
      throw new Error(message);
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