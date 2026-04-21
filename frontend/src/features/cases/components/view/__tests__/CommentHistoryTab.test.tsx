import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommentHistoryTab from '../CommentHistoryTab';

vi.mock('../../../services/commentService', () => ({
  commentService: {
    getCommentsByCaseId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    fetchInvestigatorsList: vi.fn(),
    investigators: [],
    supervisors: [],
    fetchSupervisorsList: vi.fn(),
  }),
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d,
}));

describe('CommentHistoryTab', () => {
  it('renders loading state initially', () => {
    render(<CommentHistoryTab caseId={1} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders no comments message after load', async () => {
    render(<CommentHistoryTab caseId={1} />);
    const noComments = await screen.findByText('No comments found for this case.');
    expect(noComments).toBeInTheDocument();
  });
});
