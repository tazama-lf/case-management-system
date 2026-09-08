import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VoilaFrame from '../network-analysis/VoilaFrame';

vi.mock('@/shared/components/ui/ErrorState', () => ({
  default: ({ title, message }: any) => (
    <div data-testid="error-state">
      <span>{title}</span>
      <span>{message}</span>
    </div>
  ),
}));

vi.mock('@/shared/components/ui/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

describe('VoilaFrame', () => {
  it('shows warning when VITE_API_BASE_URL is not set', () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined);
    render(<VoilaFrame notebookPath="test.ipynb" title="Test" />);
    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
  });

  it('renders iframe when VITE_API_BASE_URL is valid', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    const { container } = render(
      <VoilaFrame notebookPath="test.ipynb" title="Test" />,
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
  });

  describe('requiredParams', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    });

    it('refuses to mount and shows an error state when a required param is undefined', () => {
      const { container } = render(
        <VoilaFrame
          notebookPath="test.ipynb"
          title="Test"
          queryParams={{ accountId: undefined, tenantId: 'DEFAULT' }}
          requiredParams={['accountId']}
        />,
      );
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(container.querySelector('iframe')).toBeNull();
    });

    it('refuses to mount when a required param is the literal string "undefined"', () => {
      const { container } = render(
        <VoilaFrame
          notebookPath="test.ipynb"
          title="Test"
          queryParams={{ accountId: 'undefined', tenantId: 'DEFAULT' }}
          requiredParams={['accountId']}
        />,
      );
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(container.querySelector('iframe')).toBeNull();
    });

    it('refuses to mount when a required param is the literal string "null"', () => {
      const { container } = render(
        <VoilaFrame
          notebookPath="test.ipynb"
          title="Test"
          queryParams={{ accountId: 'null', tenantId: 'DEFAULT' }}
          requiredParams={['accountId']}
        />,
      );
      expect(container.querySelector('iframe')).toBeNull();
    });

    it('mounts normally when every required param has a real value', () => {
      const { container } = render(
        <VoilaFrame
          notebookPath="test.ipynb"
          title="Test"
          queryParams={{ accountId: 'ACC-001', tenantId: 'DEFAULT' }}
          requiredParams={['accountId']}
        />,
      );
      expect(container.querySelector('iframe')).toBeTruthy();
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    });

    it('strips undefined/null-ish values from the iframe URL instead of forwarding the literal string', () => {
      const { container } = render(
        <VoilaFrame
          notebookPath="test.ipynb"
          title="Test"
          queryParams={{
            accountId: 'ACC-001',
            debtorId: undefined,
            creditorId: 'null',
          }}
        />,
      );
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeTruthy();
      const src = iframe!.getAttribute('src')!;
      expect(src).toContain('accountId=ACC-001');
      expect(src).not.toContain('debtorId');
      expect(src).not.toContain('creditorId');
    });
  });
});
