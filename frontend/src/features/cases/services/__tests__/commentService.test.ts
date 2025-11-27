import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commentService } from '../commentService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a comment successfully', async () => {
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

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/comment?caseId=CASE-1');
    expect(result).toEqual(mockComments);
  });

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

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/comment?taskId=TASK-1');
    expect(result).toEqual(mockComments);
  });

  it('handles errors when adding comment fails', async () => {
    const error = new Error('Failed to add comment');
    (apiClient.post as vi.Mock).mockRejectedValue(error);

    await expect(
      commentService.addComment({ note: 'Test' }),
    ).rejects.toThrow('Failed to add comment');
  });
});

