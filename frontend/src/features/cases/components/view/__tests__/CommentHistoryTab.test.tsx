import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentsHistoryTab from '../CommentHistoryTab';
import { commentService } from '../../../services/commentService';
import { useInvestigatorSupervisorList } from '../../../../cases/hooks/useInvestigatorSupervisorList';

vi.mock('../../../services/commentService');
vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList');
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d ?? 'N/A',
}));

describe('CommentsHistoryTab', () => {
  const mockFetchInvestigators = vi.fn();
  const mockFetchSupervisors = vi.fn();

  const mockInvestigators = [
    { id: 'user-1', firstName: 'John', lastName: 'Doe', username: 'jdoe' },
  ];

  const mockSupervisors = [
    { id: 'sup-1', firstName: 'Jane', lastName: 'Smith', username: 'jsmith' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useInvestigatorSupervisorList as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      investigators: mockInvestigators,
      supervisors: mockSupervisors,
    });
  });

  it('displays loading state', () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<CommentsHistoryTab caseId={123} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays empty state when no comments', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(
        screen.getByText('No comments found for this case.'),
      ).toBeInTheDocument();
    });
  });

  it('displays task comments', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-1',
        user_id: 'user-1',
        task_id: 1,
        note: 'Task comment note',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Tasks Comments')).toBeInTheDocument();
      expect(screen.getByText('C-1')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Task comment note')).toBeInTheDocument();
    });
  });

  it('displays case comments', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-2',
        user_id: 'sup-1',
        note: 'Case level comment',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Case Comments')).toBeInTheDocument();
      expect(screen.getByText('C-2')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Case level comment')).toBeInTheDocument();
    });
  });

  it('shows empty task comments message when only case comments exist', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-3',
        user_id: 'user-1',
        note: 'Case only comment',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('No tasks comments found.')).toBeInTheDocument();
    });
  });

  it('shows empty case comments message when only task comments exist', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-4',
        user_id: 'user-1',
        task_id: 1,
        note: 'Task only comment',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('No case comments found.')).toBeInTheDocument();
    });
  });

  it('falls back to userId when user not found in lists', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-5',
        user_id: 'unknown-user',
        note: 'Unknown user comment',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('unknown-user')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API error'),
    );

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load comments',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('fetches investigators and supervisors lists', () => {
    (useInvestigatorSupervisorList as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      investigators: [],
      supervisors: [],
    });

    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<CommentsHistoryTab caseId={123} />);

    expect(mockFetchInvestigators).toHaveBeenCalled();
    expect(mockFetchSupervisors).toHaveBeenCalled();
  });

  it('displays both task and case comments together', async () => {
    (commentService.getCommentsByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        comment_id: 'C-10',
        user_id: 'user-1',
        task_id: 1,
        note: 'Task note here',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
      {
        comment_id: 'C-11',
        user_id: 'sup-1',
        note: 'Case note here',
        created_at: '2023-01-03T00:00:00Z',
        updated_at: '2023-01-04T00:00:00Z',
      },
    ]);

    render(<CommentsHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('C-10')).toBeInTheDocument();
      expect(screen.getByText('Task note here')).toBeInTheDocument();
      expect(screen.getByText('C-11')).toBeInTheDocument();
      expect(screen.getByText('Case note here')).toBeInTheDocument();
    });
  });
});
