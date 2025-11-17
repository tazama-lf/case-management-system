import apiClient from '../../../shared/services/apiClient';

export interface Comment {
  comment_id: string;
  user_id: string;
  case_id?: string;
  task_id?: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentDto {
  note: string;
  caseId?: string;
  taskId?: string;
}

export class CommentService {
  private baseUrl = '/api/v1/comment';

  /**
   * Add a comment to a case or task
   */
  async addComment(dto: CreateCommentDto): Promise<Comment> {
    try {
      const response = await apiClient.post<Comment>(this.baseUrl, dto);
      return response;
    } catch (error: unknown) {
      console.error('CommentService: Failed to add comment:', error);
      const message = error instanceof Error ? error.message : 'Failed to add comment';
      throw new Error(message);
    }
  }

  /**
   * Get a specific comment by ID
   */
  async getComment(commentId: string): Promise<Comment> {
    try {
      const response = await apiClient.get<Comment>(`${this.baseUrl}/${commentId}`);
      return response;
    } catch (error: unknown) {
      console.error('CommentService: Failed to get comment:', error);
      const message = error instanceof Error ? error.message : 'Failed to get comment';
      throw new Error(message);
    }
  }

  /**
   * Get all comments for a case
   */
  async getCommentsByCase(caseId: string): Promise<Comment[]> {
    try {
      const response = await apiClient.get<Comment[]>(`${this.baseUrl}?caseId=${caseId}`);
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
  async getCommentsByTask(taskId: string): Promise<Comment[]> {
    try {
      const response = await apiClient.get<Comment[]>(`${this.baseUrl}?taskId=${taskId}`);
      return Array.isArray(response) ? response : [];
    } catch (error: unknown) {
      console.error('CommentService: Failed to get comments by task:', error);
      const message = error instanceof Error ? error.message : 'Failed to get comments';
      throw new Error(message);
    }
  }
}

export const commentService = new CommentService();
