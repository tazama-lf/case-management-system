import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VoilaFrame from '../VoilaFrame';

function postNotebookMessage(iframe: HTMLIFrameElement, data: unknown, origin = 'http://localhost:3090'): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source: iframe.contentWindow as unknown as Window,
        data,
      }),
    );
  });
}

/**
 * Stubs global fetch to behave like the voila-proxy: a single GET pre-flight
 * reporting `status`/`contentType`, whose JSON body carries `message` -
 * mirroring the {statusCode, message, error} shape
 * voila-proxy.controller.ts/service.ts actually return. Not a HEAD: Voila
 * returns 405 for HEAD on this route, so the real component never sends one.
 */
function stubProxyFetch({
  status = 200,
  contentType = 'text/html',
  message = 'Something went wrong',
}: { status?: number; contentType?: string; message?: string } = {}): void {
  const ok = status >= 200 && status < 300;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok,
        status,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
        json: () => Promise.resolve({ statusCode: status, message, error: 'Error' }),
      }),
    ),
  );
}

describe('VoilaFrame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default to a healthy pre-flight so tests that aren't specifically
    // about it aren't tripped up by it.
    stubProxyFetch();
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

  it('hides loading and shows iframe once the notebook signals ready', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network') as HTMLIFrameElement;
    // The iframe's own onLoad fires for error pages just as much as real
    // ones, so it's not what flips status - the notebook's postMessage is.
    postNotebookMessage(iframe, { source: 'voila-notebook', status: 'ready' });

    expect(
      screen.queryByText('Loading visualization…'),
    ).not.toBeInTheDocument();
    expect(iframe).not.toHaveClass('invisible');
  });

  it('does not treat a bare iframe onLoad as success', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network');
    fireEvent.load(iframe);

    // A 401/500 JSON error body also fires onLoad - without a real ready
    // signal from the notebook, the frame must stay in the loading state.
    expect(screen.getByText('Loading visualization…')).toBeInTheDocument();
    expect(iframe).toHaveClass('invisible');
  });

  it('shows the error state when the proxy returns 401', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    stubProxyFetch({ status: 401, contentType: 'application/json', message: 'Token expired' });

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(await screen.findByText('Visualization Unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Token expired')).toBeInTheDocument();
  });

  it('shows the error state when the proxy returns 500', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    stubProxyFetch({ status: 500, contentType: 'application/json', message: 'Internal server error' });

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(await screen.findByText('Visualization Unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Internal server error')).toBeInTheDocument();
  });

  it('falls back to a generic message if the failed pre-flight response body is not parseable JSON', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          headers: { get: () => 'application/json' },
          json: () => Promise.reject(new Error('not json')),
        }),
      ),
    );

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(
      await screen.findByText(/Voila server may be unavailable or unreachable/i),
    ).toBeInTheDocument();
  });

  it('shows the error state when the notebook itself reports an error', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network') as HTMLIFrameElement;
    postNotebookMessage(iframe, { source: 'voila-notebook', status: 'error' });

    expect(await screen.findByText('Visualization Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/ran into a problem while loading its data/i)).toBeInTheDocument();
  });

  it('ignores a notebook message from an unexpected origin', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    const iframe = screen.getByTitle('Transaction Network') as HTMLIFrameElement;
    postNotebookMessage(iframe, { source: 'voila-notebook', status: 'ready' }, 'http://evil.example.com');

    expect(screen.getByText('Loading visualization…')).toBeInTheDocument();
  });

  it('shows the error state if the notebook never signals ready within the default 30s timeout', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/did not finish loading in time/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('honors a custom readyTimeoutMs instead of the 30s default', () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
        readyTimeoutMs={5000}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Loading visualization…')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Visualization Unavailable')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('re-runs the pre-flight and remounts the iframe when retrying after an error', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3090');
    stubProxyFetch({ status: 401, contentType: 'application/json', message: 'Token expired' });

    render(
      <VoilaFrame
        notebookPath="transaction-network.ipynb"
        title="Transaction Network"
      />,
    );

    expect(await screen.findByText('Visualization Unavailable')).toBeInTheDocument();
    const iframeBefore = screen.getByTitle('Transaction Network');
    const keyBefore = iframeBefore.getAttribute('src');

    // Session is now valid - retry should re-issue the pre-flight and pick that up.
    stubProxyFetch({ status: 200, contentType: 'text/html' });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Loading visualization…')).toBeInTheDocument();
    const iframeAfter = await screen.findByTitle('Transaction Network');
    expect(iframeAfter.getAttribute('src')).toBe(keyBefore);

    const notebookFrame = iframeAfter as HTMLIFrameElement;
    postNotebookMessage(notebookFrame, { source: 'voila-notebook', status: 'ready' });
    expect(screen.queryByText('Visualization Unavailable')).not.toBeInTheDocument();
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
