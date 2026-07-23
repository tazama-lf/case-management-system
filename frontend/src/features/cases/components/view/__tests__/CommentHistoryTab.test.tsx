import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommentHistoryTab from '../CommentHistoryTab';

const mockGetCommentsByCaseId = vi.fn().mockResolvedValue([]);
vi.mock('../../../services/commentService', () => ({
  commentService: {
    getCommentsByCaseId: (...args: any[]) => mockGetCommentsByCaseId(...args),
  },
}));

const mockInvestigators = [{ id: 'inv-1', firstName: 'John', lastName: 'Doe' }];
const mockSupervisors = [{ id: 'sup-1', firstName: 'Jane', lastName: 'Smith' }];
vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    getAssigneeFullName: (assigneeId: string) => {
      const investigator = mockInvestigators.find((u) => u.id === assigneeId);
      if (investigator) {
        return `${investigator.firstName} ${investigator.lastName}`;
      }

      const supervisor = mockSupervisors.find((u) => u.id === assigneeId);
      if (supervisor) {
        return `${supervisor.firstName} ${supervisor.lastName}`;
      }

      return assigneeId;
    },
    fetchInvestigatorsList: vi.fn(),
    investigators: mockInvestigators,
    supervisors: mockSupervisors,
    fetchSupervisorsList: vi.fn(),
  }),
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));

describe('CommentHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCommentsByCaseId.mockResolvedValue([]);
  });

  it('renders loading state initially', () => {
    render(<CommentHistoryTab caseId={1} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders no comments message after load', async () => {
    render(<CommentHistoryTab caseId={1} />);
    const noComments = await screen.findByText(
      'No comments found for this case.',
    );
    expect(noComments).toBeInTheDocument();
  });

  it('displays task comments when present', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c1',
        user_id: 'inv-1',
        task_id: 10,
        note: 'Task comment text',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Tasks Comments')).toBeInTheDocument();
      expect(screen.getByText('Task comment text')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('displays case comments when present', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c2',
        user_id: 'sup-1',
        task_id: null,
        note: 'Case comment text',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Case Comments')).toBeInTheDocument();
      expect(screen.getByText('Case comment text')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows both task and case comments', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c1',
        user_id: 'inv-1',
        task_id: 10,
        note: 'Task note',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        comment_id: 'c2',
        user_id: 'sup-1',
        task_id: null,
        note: 'Case note',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Task note')).toBeInTheDocument();
      expect(screen.getByText('Case note')).toBeInTheDocument();
    });
  });

  it('shows no tasks comments message when only case comments exist', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c2',
        user_id: 'sup-1',
        task_id: null,
        note: 'Case note',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('No tasks comments found.')).toBeInTheDocument();
    });
  });

  it('shows no case comments message when only task comments exist', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c1',
        user_id: 'inv-1',
        task_id: 10,
        note: 'Task note',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('No case comments found.')).toBeInTheDocument();
    });
  });

  it('falls back to user_id when user is not found in lists', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'c3',
        user_id: 'unknown-user',
        task_id: null,
        note: 'Comment',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('unknown-user')).toBeInTheDocument();
    });
  });

  it('displays comment_id, task_id, dates for task comments', async () => {
    mockGetCommentsByCaseId.mockResolvedValue([
      {
        comment_id: 'CMT-123',
        user_id: 'inv-1',
        task_id: 42,
        note: 'Note text',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
    ]);
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(screen.getByText('CMT-123')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('2024-01-02')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    mockGetCommentsByCaseId.mockRejectedValue(new Error('Failed'));
    render(<CommentHistoryTab caseId={1} />);
    await waitFor(() => {
      expect(
        screen.getByText('No comments found for this case.'),
      ).toBeInTheDocument();
    });
  });

  it('calls getCommentsByCaseId with correct caseId', async () => {
    render(<CommentHistoryTab caseId={42} />);
    await waitFor(() => {
      expect(mockGetCommentsByCaseId).toHaveBeenCalledWith(42);
    });
  });
});
