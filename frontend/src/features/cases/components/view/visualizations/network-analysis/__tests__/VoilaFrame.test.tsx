import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VoilaFrame from '../VoilaFrame';

describe('VoilaFrame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders error state when VITE_API_BASE_URL is not set', () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined);

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/network visualization service is not configured/i),
    ).toBeInTheDocument();
  });

  it('renders error state when VITE_API_BASE_URL is empty string', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
  });

  it('renders error state when VITE_API_BASE_URL is a relative path', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
  });

  it('renders iframe with correct src when VITE_API_BASE_URL is valid', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain(
      'http://localhost:3090/voila-proxy/voila/render/transaction-network.ipynb',
    );
  });

  it('appends query params to iframe src', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
        queryParams={{ accountId: 'ACC-123', timeRange: 'month' }}
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    const src = iframe.getAttribute('src') ?? '';
    expect(src).toContain('accountId=ACC-123');
    expect(src).toContain('timeRange=month');
  });

  it('shows loading spinner initially', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(screen.getByText('Loading visualization…')).toBeInTheDocument();
  });

  it('hides loading and shows iframe on load', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    fireEvent.load(iframe);

    expect(
      screen.queryByText('Loading visualization…'),
    ).not.toBeInTheDocument();
    expect(iframe).not.toHaveClass('invisible');
  });

  it('iframe is invisible while loading', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    expect(iframe.className).toContain('invisible');
  });

  it('generates new iframe key on voilaUrl change via queryParams', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    const { rerender } = render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
        queryParams={{ accountId: 'ACC-1' }}
      />,
    );

    const iframe1 = screen.getByTitle('Transaction Network');
    const src1 = iframe1.getAttribute('src');

    rerender(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
        queryParams={{ accountId: 'ACC-2' }}
      />,
    );

    const iframe2 = screen.getByTitle('Transaction Network');
    const src2 = iframe2.getAttribute('src');
    expect(src1).not.toBe(src2);
    expect(src2).toContain('accountId=ACC-2');
  });

  it('sets correct sandbox attributes on iframe', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups',
    );
  });
});
