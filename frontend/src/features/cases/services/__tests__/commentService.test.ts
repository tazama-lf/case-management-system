import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commentService } from '../commentService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCommentsByCaseId', () => {
    it('gets tasks with comments by case ID', async () => {
      const mockComments = [
        {
          comment_id: 1,
          user_id: 'user-1',
          case_id: 1,
          task_id: 1,
          note: 'Task comment',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          comments: [],
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockComments);

      const result = await commentService.getCommentsByCaseId(1);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment/case/1/comment',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await commentService.getCommentsByCaseId(1);

      expect(result).toEqual([]);
    });

    it('throws with API response message on error', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue({
        response: { data: { message: 'Unauthorized' } },
      });

      await expect(commentService.getCommentsByCaseId(1)).rejects.toThrow(
        'Unauthorized',
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws with Error message on generic error', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('Network error'));

      await expect(commentService.getCommentsByCaseId(1)).rejects.toThrow(
        'Failed to get tasks with comments by case ID: Network error',
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws generic fallback for non-Error objects', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('string-error');

      await expect(commentService.getCommentsByCaseId(1)).rejects.toThrow(
        'Failed to get tasks with comments by case ID',
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws with API response that has no message', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue({
        response: { data: {} },
      });

      await expect(commentService.getCommentsByCaseId(1)).rejects.toThrow(
        'Failed to get tasks with comments by case ID',
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCommentsByTaskId', () => {
    it('gets tasks with comments by task ID', async () => {
      const mockComments = [
        {
          comment_id: 1,
          user_id: 'user-1',
          case_id: 1,
          task_id: 5,
          note: 'Comment on task',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          comments: [],
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockComments);

      const result = await commentService.getCommentsByTaskId(5);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment/task/5/comment',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue('not-array');

      const result = await commentService.getCommentsByTaskId(5);

      expect(result).toEqual([]);
    });

    it('throws with API response message on error', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue({
        response: { data: { message: 'Forbidden' } },
      });

      await expect(commentService.getCommentsByTaskId(5)).rejects.toThrow(
        'Forbidden',
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws with Error message on generic error', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('Timeout'));

      await expect(commentService.getCommentsByTaskId(5)).rejects.toThrow(
        'Failed to get tasks with comments by task ID: Timeout',
      );
      consoleErrorSpy.mockRestore();
    });

    it('throws generic fallback for non-Error objects', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(42);

      await expect(commentService.getCommentsByTaskId(5)).rejects.toThrow(
        'Failed to get tasks with comments by task ID',
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('addComment', () => {
    it('adds a comment successfully with caseId', async () => {
      const mockComment = {
        comment_id: 'COMMENT-1',
        user_id: 'user-1',
        case_id: 'CASE-1',
        note: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockComment);

      const result = await commentService.addComment({
        note: 'Test comment',
        caseId: 'CASE-1' as any,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/comment', {
        note: 'Test comment',
        caseId: 'CASE-1',
      });
      expect(result).toEqual(mockComment);
    });

    it('adds a comment successfully with taskId', async () => {
      const mockComment = {
        comment_id: 'COMMENT-1',
        user_id: 'user-1',
        task_id: 'TASK-1',
        note: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockComment);

      const result = await commentService.addComment({
        note: 'Test comment',
        taskId: 'TASK-1' as any,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/comment', {
        note: 'Test comment',
        taskId: 'TASK-1',
      });
      expect(result).toEqual(mockComment);
    });

    it('adds a comment without caseId or taskId', async () => {
      const mockComment = {
        comment_id: 'COMMENT-1',
        user_id: 'user-1',
        note: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockComment);

      const result = await commentService.addComment({
        note: 'Test comment',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/comment', {
        note: 'Test comment',
      });
      expect(result).toEqual(mockComment);
    });

    it('handles errors when adding comment fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to add comment');
      (apiClient.post as vi.Mock).mockRejectedValue(error);

      await expect(commentService.addComment({ note: 'Test' })).rejects.toThrow(
        'Failed to add comment',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.post as vi.Mock).mockRejectedValue('String error');

      await expect(commentService.addComment({ note: 'Test' })).rejects.toThrow(
        'Failed to add comment',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getComment', () => {
    it('gets a comment by ID', async () => {
      const mockComment = {
        comment_id: 'COMMENT-1',
        user_id: 'user-1',
        note: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockComment);

      const result = await commentService.getComment('COMMENT-1' as any);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/comment/COMMENT-1');
      expect(result).toEqual(mockComment);
    });

    it('handles errors when getting comment fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comment');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        commentService.getComment('COMMENT-1' as any),
      ).rejects.toThrow('Failed to get comment');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(
        commentService.getComment('COMMENT-1' as any),
      ).rejects.toThrow('Failed to get comment');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCommentsByCase', () => {
    it('gets comments by case ID', async () => {
      const mockComments = [
        {
          comment_id: 'COMMENT-1',
          case_id: 'CASE-1',
          note: 'Comment 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockComments);

      const result = await commentService.getCommentsByCase('CASE-1' as any);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment?caseId=CASE-1',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await commentService.getCommentsByCase('CASE-1' as any);

      expect(result).toEqual([]);
    });

    it('handles errors when getting comments fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comments');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        commentService.getCommentsByCase('CASE-1' as any),
      ).rejects.toThrow('Failed to get comments');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(
        commentService.getCommentsByCase('CASE-1' as any),
      ).rejects.toThrow('Failed to get comments');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCommentsByTask', () => {
    it('gets comments by task ID', async () => {
      const mockComments = [
        {
          comment_id: 'COMMENT-1',
          task_id: 'TASK-1',
          note: 'Task comment',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockComments);

      const result = await commentService.getCommentsByTask('TASK-1' as any);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment?taskId=TASK-1',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await commentService.getCommentsByTask('TASK-1' as any);

      expect(result).toEqual([]);
    });

    it('handles errors when getting comments fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comments');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        commentService.getCommentsByTask('TASK-1' as any),
      ).rejects.toThrow('Failed to get comments');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(
        commentService.getCommentsByTask('TASK-1' as any),
      ).rejects.toThrow('Failed to get comments');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
