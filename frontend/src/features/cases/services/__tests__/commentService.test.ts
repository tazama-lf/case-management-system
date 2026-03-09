import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commentService } from '../commentService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        caseId: 'CASE-1',
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
        taskId: 'TASK-1',
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

      const result = await commentService.getComment('COMMENT-1');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/comment/COMMENT-1');
      expect(result).toEqual(mockComment);
    });

    it('handles errors when getting comment fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comment');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(commentService.getComment('COMMENT-1')).rejects.toThrow(
        'Failed to get comment',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(commentService.getComment('COMMENT-1')).rejects.toThrow(
        'Failed to get comment',
      );

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

      const result = await commentService.getCommentsByCase('CASE-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment?caseId=CASE-1',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await commentService.getCommentsByCase('CASE-1');

      expect(result).toEqual([]);
    });

    it('handles errors when getting comments fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comments');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(commentService.getCommentsByCase('CASE-1')).rejects.toThrow(
        'Failed to get comments',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(commentService.getCommentsByCase('CASE-1')).rejects.toThrow(
        'Failed to get comments',
      );

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

      const result = await commentService.getCommentsByTask('TASK-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/comment?taskId=TASK-1',
      );
      expect(result).toEqual(mockComments);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await commentService.getCommentsByTask('TASK-1');

      expect(result).toEqual([]);
    });

    it('handles errors when getting comments fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to get comments');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(commentService.getCommentsByTask('TASK-1')).rejects.toThrow(
        'Failed to get comments',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue('String error');

      await expect(commentService.getCommentsByTask('TASK-1')).rejects.toThrow(
        'Failed to get comments',
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
