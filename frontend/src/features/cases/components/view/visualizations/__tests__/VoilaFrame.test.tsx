import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
  it('shows warning when VITE_VOILA_BASE_URL is not set', () => {
    const originalEnv = import.meta.env.VITE_VOILA_BASE_URL;
    // @ts-ignore
    import.meta.env.VITE_VOILA_BASE_URL = undefined;
    render(<VoilaFrame notebookPath="test.ipynb" title="Test" />);
    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
    import.meta.env.VITE_VOILA_BASE_URL = originalEnv;
  });

  it('renders iframe when VITE_VOILA_BASE_URL is valid', () => {
    const originalEnv = import.meta.env.VITE_VOILA_BASE_URL;
    // @ts-ignore
    import.meta.env.VITE_VOILA_BASE_URL = 'https://voila.example.com';
    const { container } = render(
      <VoilaFrame notebookPath="test.ipynb" title="Test" />,
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    import.meta.env.VITE_VOILA_BASE_URL = originalEnv;
  });
});
