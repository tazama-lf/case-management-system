import React, { useEffect, useMemo, useRef } from 'react';
import ErrorState from '@/shared/components/ui/ErrorState';
import LoadingSpinner from '@/shared/components/ui/LoadingSpinner';

interface VoilaFrameProps {
  notebookPath: string;
  title: string;
  queryParams?: Record<string, string | undefined | null>;
  /**
   * Names (keys into queryParams) that must resolve to a real value after
   * filtering. If any is missing, the iframe never mounts - shows an error
   * state instead. Belt-and-braces against a caller passing through an
   * undefined/null id (e.g. from a backend contract that regresses to a
   * truthy-but-empty response) that would otherwise reach the notebook as
   * the literal string "undefined".
   */
  requiredParams?: string[];
  /** How long to wait for the notebook's ready signal before treating the load as hung. Defaults to 30s. */
  readyTimeoutMs?: number;
}

/**
 * The postMessage payload contract with the notebook side. This is the
 * single source of truth for the *shape* on the frontend, but the actual
 * values are constructed independently in Python - see
 * `notebooks/_cms_signal_ready.py` (the shared helper every notebook's
 * final cell calls) for the other half of this contract. If the two drift
 * (e.g. a typo in `source`), `isVoilaNotebookMessage` below silently
 * rejects the message and the parent times out after `readyTimeoutMs`
 * instead of ever seeing 'ready' - there's no end-to-end test across the
 * JS/Python boundary that would catch that, so keep both sides in sync by
 * hand when either changes.
 */
interface VoilaNotebookMessage {
  source: 'voila-notebook';
  status: 'ready' | 'error';
}

function isVoilaNotebookMessage(data: unknown): data is VoilaNotebookMessage {
  if (typeof data !== 'object' || data === null) return false;
  const { source, status } = data as { source?: unknown; status?: unknown };
  return source === 'voila-notebook' && (status === 'ready' || status === 'error');
}

const isMissingValue = (value: string | undefined | null): boolean =>
  value === undefined || value === null || value === 'undefined' || value === 'null';

const DEFAULT_READY_TIMEOUT_MS = 30000;
const INITIAL_RETRY_COUNT = 0;
const NO_MISSING_PARAMS = 0;
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
 * 1. A HEAD pre-flight checking status + Content-Type - catches a 401
 *    (session expired) before it'd render as a JSON blob. The proxy
 *    short-circuits an authenticated HEAD on the render route itself,
 *    without ever forwarding it to Voila (which doesn't support HEAD there
 *    and would 405), so this costs nothing extra on the happy path. On
 *    failure a follow-up GET reads the real error message out of the body,
 *    since HEAD responses never carry one.
 * 2. A postMessage the notebook sends from its final cell once it's truly
 *    done (see notebooks/*.ipynb) - catches a caught backend error, a
 *    kernel crash, or a hung render, none of which change the HTTP status.
 *
 * Separately, `requiredParams` gates mounting the iframe at all: any
 * undefined/null/"undefined"/"null" value for a required key means there's
 * no matching record to visualize yet, so this shows its own error state
 * instead of ever sending the notebook a literal "undefined".
 *
 * Validates that VITE_API_BASE_URL is set to an absolute HTTP/HTTPS URL
 * before constructing the src. If the variable is missing, the browser
 * would treat a relative path as same-origin and the SPA catch-all would
 * return the CMS itself inside the frame.
 */
const VoilaFrame: React.FC<VoilaFrameProps> = ({
  notebookPath,
  title,
  queryParams,
  requiredParams,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}) => {
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [errorMessage, setErrorMessage] = React.useState<string>(GENERIC_ERROR_MESSAGE);
  const [retryCount, setRetryCount] = React.useState(INITIAL_RETRY_COUNT);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sanitizedParams = React.useMemo(() => {
    const result: Record<string, string> = {};
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => {
        if (typeof v !== 'string' || isMissingValue(v)) return;
        result[k] = v;
      });
    }
    return result;
  }, [queryParams]);

  const missingRequiredParams = React.useMemo(
    // Deliberately broader than isMissingValue (which strips exactly
    // undefined/null/"undefined"/"null"): a required param that comes
    // through as an empty or whitespace-only string is just as unusable as
    // a missing one, so any blank value here - not only the four stripped
    // cases - fails the gate instead of mounting the iframe and letting the
    // notebook's own require_notebook_params() reject it after a wasted
    // round trip.
    //
    // The `?.` below is load-bearing, not redundant: TS types
    // sanitizedParams[name] as `string` because the object's declared type
    // is Record<string, string>, but `name` comes from the caller's
    // requiredParams array and isn't guaranteed to be a key that was ever
    // set - a name absent from queryParams entirely looks up as `undefined`
    // at runtime regardless of what the index signature claims. Dropping
    // the `?.` would throw on `.trim()` for exactly that case.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- sanitizedParams[name] can be undefined at runtime for a name that was never a key, despite the Record<string, string> type saying otherwise
    () => (requiredParams ?? []).filter((name) => !sanitizedParams[name]?.trim()),
    [requiredParams, sanitizedParams],
  );

  const voilaUrl = React.useMemo(() => {
    if (missingRequiredParams.length > NO_MISSING_PARAMS) {
      return null;
    }

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

    Object.entries(sanitizedParams).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    return url.toString();
  }, [notebookPath, sanitizedParams, missingRequiredParams]);

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
      // TODO(telemetry): wire into Sentry/RUM when available - console.error
      // is currently the only record that a visualization silently failed.
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
    //    the frame while the parent thinks the load succeeded. This is a
    //    HEAD - the proxy now short-circuits an authenticated HEAD on the
    //    render route to a plain 200 without ever forwarding it to Voila
    //    (see VoilaProxyController.proxyToVoila), so the happy path costs
    //    nothing extra: no second kernel start, no second DLH round trip.
    //    HEAD responses never carry a body, so on failure we issue one
    //    follow-up GET - only then - to read the real error message out of
    //    the JSON body; that GET is itself cheap for 401/502 specifically,
    //    since the proxy rejects those before ever reaching Voila either.
    //
    //    Trade-off: because the proxy answers HEAD without actually asking
    //    Voila anything, this no longer detects "Voila is genuinely down"
    //    the way the (now-removed) full-GET pre-flight did - that failure
    //    mode falls through to the postMessage/timeout check below instead,
    //    surfacing ~readyTimeoutMs later rather than immediately.
    const runPreflight = async (): Promise<void> => {
      try {
        const res = await fetch(voilaUrl, { method: 'HEAD', credentials: 'include', signal: controller.signal });
        const contentType = res.headers.get('content-type') ?? '';
        const isHealthy = res.status === PROXY_SUCCESS_STATUS && contentType.includes('text/html');
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
        resolveError(message, { httpStatus: res.status, contentType });
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

  if (missingRequiredParams.length > NO_MISSING_PARAMS) {
    return (
      <div className="flex h-[750px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="w-full max-w-md">
          <ErrorState
            severity="warning"
            title="Visualization Unavailable"
            message={`Missing required data for this visualization (${missingRequiredParams.join(', ')}). This usually means there's no matching record for this alert yet.`}
            showRetry={false}
            size="large"
          />
        </div>
      </div>
    );
  }

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
