import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/auth/services/authService', () => ({ default: { hasAnyRole: vi.fn() } }));

import apiClient from '@/shared/services/apiClient';
import authService from '@/features/auth/services/authService';
import { GovernanceReportButton, GovernanceReportView } from '../GovernanceReportPanel';
import type { GovernanceReport } from '../copilotService';

const report = (over: Partial<GovernanceReport> = {}): GovernanceReport => ({
  tenantId: 'TAZAMA',
  from: '2026-09-28T00:00:00.000Z',
  to: '2026-10-28T00:00:00.000Z',
  records: { INVESTIGATION: 4, ASK: 9, SAR_DRAFT: 2, SAR_REVIEW: 3, FEEDBACK: 2 },
  models: [
    {
      provider: 'bundled',
      model: 'qwen3-4b-instruct-2507',
      file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
      build: 'b11398-a7b94df2c',
      promptVersion: '3f2a9c1b77aa',
      strategy: 'agent',
      records: 15,
    },
  ],
  writing: {
    modelParts: 20,
    codeParts: 3,
    sentencesKept: 45,
    sentencesRemoved: 5,
    removalReasons: [{ reason: 'the number # is not in the cited facts', count: 4 }],
  },
  agent: { runs: 4, fellBack: 1 },
  feedback: {
    up: 1,
    down: 1,
    recent: [{ recordId: 239, rating: 'down', comment: 'Missed the new device', at: '2026-10-27T20:41:37.000Z' }],
  },
  review: { SUBMIT: 2, RETURN: 1, APPROVE: 1 },
  chain: { ok: true, checked: 20, unchained: 239, head: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' },
  ...over,
});

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(authService.hasAnyRole).mockReset();
});

describe('GovernanceReportView', () => {
  it('shows records, models, writing, feedback, review and an intact chain', () => {
    render(<GovernanceReportView report={report()} />);
    expect(screen.getByText('Chat answers')).toBeInTheDocument();
    expect(screen.getByText('Qwen3-4B-Instruct-2507-Q4_K_M.gguf')).toBeInTheDocument();
    expect(screen.getByText('3f2a9c1b77aa')).toBeInTheDocument();
    expect(screen.getByText(/45 model sentences kept and 5 removed by the checks \(90% kept\)/)).toBeInTheDocument();
    expect(screen.getByText('the number # is not in the cited facts')).toBeInTheDocument();
    expect(screen.getByText(/of which 1 fell back/)).toBeInTheDocument();
    expect(screen.getByText(/Missed the new device/)).toBeInTheDocument();
    expect(screen.getByText('Submitted 2 · Returned 1 · Approved 1')).toBeInTheDocument();
    expect(screen.getByText(/Record chain intact: 20 records checked/)).toBeInTheDocument();
    expect(screen.getByTitle('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBeInTheDocument();
    expect(screen.getByText(/239 older records were written before the chain/)).toBeInTheDocument();
  });

  it('says where and why the chain is broken', () => {
    render(
      <GovernanceReportView
        report={report({
          chain: { ok: false, checked: 7, unchained: 0, head: 'abc', brokenAt: 251, reason: 'the record was changed after it was written' },
        })}
      />,
    );
    expect(
      screen.getByText(/Record chain broken at record 251: the record was changed after it was written\. 7 records before it checked\./),
    ).toBeInTheDocument();
  });

  it('handles an empty period', () => {
    render(
      <GovernanceReportView
        report={report({
          records: {},
          models: [],
          review: {},
          writing: { modelParts: 0, codeParts: 0, sentencesKept: 0, sentencesRemoved: 0, removalReasons: [] },
        })}
      />,
    );
    expect(screen.getByText('No copilot records in this period.')).toBeInTheDocument();
    expect(screen.getByText(/No model sentences were checked/)).toBeInTheDocument();
    expect(screen.getByText('No review steps in this period.')).toBeInTheDocument();
  });
});

describe('GovernanceReportButton', () => {
  it('is hidden from users who are not supervisors or compliance officers', () => {
    vi.mocked(authService.hasAnyRole).mockReturnValue(false);
    render(<GovernanceReportButton />);
    expect(screen.queryByRole('button', { name: /Governance report/ })).not.toBeInTheDocument();
    expect(authService.hasAnyRole).toHaveBeenCalledWith(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER']);
  });

  it('opens the report for the last 30 days, and loads another period on request', async () => {
    vi.mocked(authService.hasAnyRole).mockReturnValue(true);
    vi.mocked(apiClient.get).mockResolvedValue(report());
    render(<GovernanceReportButton />);
    await userEvent.click(screen.getByRole('button', { name: /Governance report/ }));
    expect(screen.getByRole('dialog', { name: 'Copilot governance report' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Record chain intact/)).toBeInTheDocument();
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/copilot/governance?days=30');
    await userEvent.click(screen.getByRole('button', { name: '90 days' }));
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/copilot/governance?days=90');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the error when the report cannot be loaded', async () => {
    vi.mocked(authService.hasAnyRole).mockReturnValue(true);
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Forbidden'));
    render(<GovernanceReportButton />);
    await userEvent.click(screen.getByRole('button', { name: /Governance report/ }));
    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });
});
