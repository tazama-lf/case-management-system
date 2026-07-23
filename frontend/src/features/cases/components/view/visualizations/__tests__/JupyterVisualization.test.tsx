import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import JupyterVisualization from '../shared/JupyterVisualization';
import { server } from '@/test/mocks/server';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/shared/services/apiClient';

beforeEach(() => {
  // Prevent MSW from throwing on the iframe src URL that happy-dom tries to fetch
  server.use(
    http.get(
      'https://jupyter.test/*',
      () => new HttpResponse(null, { status: 200 }),
    ),
  );
});

describe('JupyterVisualization', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    render(
      <JupyterVisualization
        notebook="test-notebook"
        params={{ key: 'value' }}
      />,
    );
    expect(screen.getByText('Loading visualization...')).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    render(
      <JupyterVisualization
        notebook="test-notebook"
        params={{ key: 'value' }}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText('Failed to load visualization configuration'),
      ).toBeInTheDocument();
    });
  });

  it('renders iframe on successful fetch', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      url: 'https://jupyter.test/viz',
    });
    const { container } = render(
      <JupyterVisualization
        notebook="test-notebook"
        params={{ key: 'value' }}
        title="Test Viz"
      />,
    );
    await waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeTruthy();
    });
  });
});
