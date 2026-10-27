import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import apiClient from '@/shared/services/apiClient';
import FeedbackButtons from '../FeedbackButtons';

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset();
});

describe('FeedbackButtons', () => {
  it('sends a thumbs up at once and says it was recorded', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 1 });
    render(<FeedbackButtons caseId={17} recordId={238} />);
    await userEvent.click(screen.getByRole('button', { name: 'Useful' }));
    await waitFor(() => {
      expect(screen.getByText('Thanks, recorded.')).toBeInTheDocument();
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/copilot/cases/17/feedback', {
      recordId: 238,
      rating: 'up',
      comment: undefined,
    });
  });

  it('asks what was wrong on a thumbs down and sends the comment', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 2 });
    render(<FeedbackButtons caseId={17} recordId={239} />);
    await userEvent.click(screen.getByRole('button', { name: 'Not useful' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('What was wrong?'), '  Says no device, but F19 has one  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByText('Thanks, recorded.')).toBeInTheDocument();
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/copilot/cases/17/feedback', {
      recordId: 239,
      rating: 'down',
      comment: 'Says no device, but F19 has one',
    });
  });

  it('shows the error and keeps the buttons when saving fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Record not found in this case'));
    render(<FeedbackButtons caseId={17} recordId={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Useful' }));
    await waitFor(() => {
      expect(screen.getByText('Record not found in this case')).toBeInTheDocument();
    });
    expect(screen.queryByText('Thanks, recorded.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Useful' })).toBeEnabled();
  });
});
