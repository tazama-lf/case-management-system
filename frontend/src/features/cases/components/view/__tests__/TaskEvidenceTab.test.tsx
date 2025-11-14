import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskEvidenceTab from '../TaskEvidenceTab';

describe('TaskEvidenceTab', () => {
  it('adds selected files to the preview list for a section', async () => {
    render(<TaskEvidenceTab />);

  const input = document.getElementById('sanctions-uploader') as HTMLInputElement;
    const fileOne = new File(['hello'], 'identity-proof.pdf', { type: 'application/pdf' });
    const fileTwo = new File(['world'], 'sanctions-report.csv', { type: 'text/csv' });

  await userEvent.upload(input, [fileOne, fileTwo]);

    expect(await screen.findByText('identity-proof.pdf')).toBeInTheDocument();
    expect(await screen.findByText('sanctions-report.csv')).toBeInTheDocument();
    const statuses = await screen.findAllByText('Ready to upload');
    expect(statuses).toHaveLength(2);
  });
});
