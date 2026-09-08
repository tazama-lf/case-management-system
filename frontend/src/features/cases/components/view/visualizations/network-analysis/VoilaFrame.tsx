import React, { useEffect, useMemo, useRef } from 'react';
import ErrorState from '@/shared/components/ui/ErrorState';
import LoadingSpinner from '@/shared/components/ui/LoadingSpinner';

interface VoilaFrameProps {
  notebookPath: string;
  title: string;
  queryParams?: Record<string, string>;
  readyTimeoutMs?: number;
}

interface VoilaNotebookMessage {
  source: 'voila-notebook';
  status: 'ready' | 'error';
}

function isVoilaNotebookMessage(data: unknown): data is VoilaNotebookMessage {
  if (typeof data !== 'object' || data === null) return false;
  const { source, status } = data as { source?: unknown; status?: unknown };
  return source === 'voila-notebook' && (status === 'ready' || status === 'error');
}

// How long to wait for the notebook's own "I'm done" signal before treating
// the load as hung. Long enough to cover a cold kernel plus a slow DLH query.
const DEFAULT_READY_TIMEOUT_MS = 30000;
const INITIAL_RETRY_COUNT = 0;
const RETRY_STEP = 1;
const PROXY_SUCCESS_STATUS = 200;

const GENERIC_ERROR_MESSAGE =
  'The visualization could not be loaded. The Voila server may be unavailable or unreachable. Please try again or contact your system administrator.';

/**
 * Renders a Voila notebook inside an iframe.
 *
 * The iframe's onLoad fires even for a 401/500/502 error body, and onError
 * only fires for transport failures that don't happen against a same-
 * cluster proxy - so neither is a trustworthy success/failure signal. This
 * component ignores both and instead races two checks in parallel with the
 * iframe load; whichever resolves first (or a timeout) sets the status:
 *
 * 1. A HEAD pre-flight checking status + Content-Type - catches a 401/502
 *    before it'd render as a JSON blob. On failure, a follow-up GET reads
 *    the real error message out of the JSON body.
 * 2. A postMessage the notebook sends from its final cell once it's truly
 *    done (see notebooks/*.ipynb) - catches a caught backend error, a
 *    kernel crash, or a hung render, none of which change the HTTP status.
 *
 * Validates that VITE_VOILA_BASE_URL is set to an absolute HTTP/HTTPS URL
 * before constructing the src. If the variable is missing or resolves to a
 * relative path (e.g. "undefined/..."), the browser would treat it as same-
 * origin and the SPA catch-all would return the CMS itself inside the frame.
 */
const VoilaFrame: React.FC<VoilaFrameProps> = ({
  notebookPath,
  title,
  queryParams,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}) => {
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [errorMessage, setErrorMessage] = React.useState<string>(GENERIC_ERROR_MESSAGE);
  const [retryCount, setRetryCount] = React.useState(INITIAL_RETRY_COUNT);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const voilaUrl = React.useMemo(() => {
    // Use NestJS proxy instead of direct Voila URL for security
    // The proxy validates user JWT from cookie, mints service token, and forwards to Voila
    const backendUrl: string | undefined = import.meta.env.VITE_API_BASE_URL as string | undefined;

    // Validate backend URL is configured
    if (!backendUrl || typeof backendUrl !== 'string') {
      return null;
    }

    // Remove any trailing slashes from backend URL
    const cleanBackendUrl = backendUrl.replace(/\/+$/u, '');

    // Construct proxy URL: /voila-proxy/voila/render/{notebook}
    const url = new URL(
      `/voila-proxy/voila/render/${notebookPath}`,
      cleanBackendUrl,
    );

    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => {
        url.searchParams.set(k, v);
      });
    }
    return url.toString();
  }, [notebookPath, queryParams]);

  // The origin the notebook's postMessage should be arriving from - used to
  // reject messages from anywhere else on the page.
  const voilaOrigin = useMemo(() => {
    if (!voilaUrl) return null;
    try {
      return new URL(voilaUrl).origin;
    } catch {
      return null;
    }
  }, [voilaUrl]);

  const handleRetry = (): void => {
    setRetryCount((c) => c + RETRY_STEP);
  };

  useEffect(() => {
    if (!voilaUrl || !voilaOrigin) return undefined;

    setStatus('loading');
    setErrorMessage(GENERIC_ERROR_MESSAGE);

    let resolved = false;
    const controller = new AbortController();

    const resolveError = (message: string, logContext: Record<string, unknown>): void => {
      if (resolved) return;
      resolved = true;
      // No frontend monitoring/telemetry service is wired up yet; this is
      // currently the only record that a visualization silently failed.
      console.error('[VoilaFrame] visualization failed to load', { notebookPath, voilaUrl, ...logContext });
      setErrorMessage(message);
      setStatus('error');
    };

    const resolveSuccess = (): void => {
      if (resolved) return;
      resolved = true;
      setStatus('loaded');
    };

    // 1) Pre-flight: catches proxy-level failures (401 session expired, 502
    //    Voila down) before they'd otherwise render as a JSON blob inside
    //    the frame while the parent thinks the load succeeded. A cheap HEAD
    //    is enough to check status + Content-Type (both come back on HEAD
    //    responses same as GET) without paying for a full notebook
    //    execution on every load. Only on a confirmed failure do we issue a
    //    second, GET request - to read the actual error message out of the
    //    JSON body - since that second request is itself cheap (proxy-level
    //    failures return before ever reaching Voila).
    const runPreflight = async (): Promise<void> => {
      try {
        const headRes = await fetch(voilaUrl, { method: 'HEAD', credentials: 'include', signal: controller.signal });
        const contentType = headRes.headers.get('content-type') ?? '';
        const isHealthy = headRes.status === PROXY_SUCCESS_STATUS && contentType.includes('text/html');
        if (isHealthy) return;

        let message = GENERIC_ERROR_MESSAGE;
        try {
          const bodyRes = await fetch(voilaUrl, { credentials: 'include', signal: controller.signal });
          const body: unknown = await bodyRes.json();
          const bodyMessage = (body as { message?: unknown } | null)?.message;
          if (typeof bodyMessage === 'string' && bodyMessage !== '') {
            message = bodyMessage;
          }
        } catch {
          // Body wasn't valid/parseable JSON - fall back to the generic message.
        }
        resolveError(message, { httpStatus: headRes.status, contentType });
      } catch (err) {
        if (controller.signal.aborted) return;
        resolveError(GENERIC_ERROR_MESSAGE, { error: err instanceof Error ? err.message : String(err) });
      }
    };
    void runPreflight();

    // 2) The notebook's own final cell posts {source:'voila-notebook', status}
    //    once it actually finishes rendering - catches a caught backend
    //    error, a kernel crash, or a hung render, none of which the iframe's
    //    onLoad/onError events would ever surface.
    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (event.origin !== voilaOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { data } = event;
      if (!isVoilaNotebookMessage(data)) return;
      if (data.status === 'ready') {
        resolveSuccess();
      } else {
        resolveError(
          'The visualization ran into a problem while loading its data. Please try again or contact your system administrator.',
          { notebookReportedError: true },
        );
      }
    };
    window.addEventListener('message', handleMessage);

    // 3) If neither of the above ever resolves - a hung kernel or a very
    //    slow DLH query - fail instead of spinning forever.
    const timeoutId = window.setTimeout(() => {
      resolveError('The visualization did not finish loading in time. It may still be starting up - please try again.', {
        timedOutAfterMs: readyTimeoutMs,
      });
    }, readyTimeoutMs);

    return () => {
      resolved = true; // stop a superseded attempt from resolving after cleanup
      controller.abort();
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
    };
  }, [voilaUrl, voilaOrigin, notebookPath, retryCount, readyTimeoutMs]);

  if (!voilaUrl) {
    return (
      <div className="flex h-[750px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="w-full max-w-md">
          <ErrorState
            severity="warning"
            title="Visualization Unavailable"
            message="The network visualization service is not configured. Please set VITE_API_BASE_URL in your environment configuration and restart the application."
            showRetry={false}
            size="large"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[750px] w-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500">Loading visualization…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white p-8">
          <div className="w-full max-w-md">
            <ErrorState
              severity="error"
              title="Visualization Unavailable"
              message={errorMessage}
              showRetry
              onRetry={handleRetry}
              size="large"
            />
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={`${voilaUrl}-${retryCount}`}
        src={voilaUrl}
        className={`h-full w-full rounded-lg border-0${status === 'loaded' ? '' : ' invisible'}`}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onError={() => {
          console.error('[VoilaFrame] iframe transport error', { notebookPath, voilaUrl });
          setErrorMessage(GENERIC_ERROR_MESSAGE);
          setStatus('error');
        }}
      />
    </div>
  );
};

export default VoilaFrame;
