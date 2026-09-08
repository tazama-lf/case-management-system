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
}

const isMissingValue = (value: string | undefined | null): boolean =>
  value === undefined || value === null || value === 'undefined' || value === 'null';

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
const INITIAL_RETRY_COUNT = 0;
const NO_MISSING_PARAMS = 0;
const RETRY_STEP = 1;

const VoilaFrame: React.FC<VoilaFrameProps> = ({
  notebookPath,
  title,
  queryParams,
  requiredParams,
}) => {
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = React.useState(INITIAL_RETRY_COUNT);

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
    () => (requiredParams ?? []).filter((name) => isMissingValue(sanitizedParams[name])),
    [requiredParams, sanitizedParams],
  );

  const voilaUrl = React.useMemo(() => {
    if (missingRequiredParams.length > NO_MISSING_PARAMS) {
      return null;
    }

    // Use NestJS proxy instead of direct Voila URL for security
    // The proxy validates user JWT from cookie, mints service token, and forwards to Voila
    const backendUrl: string | undefined = import.meta.env.VITE_API_BASE_URL as string | undefined;
    const backendUrl: string | undefined = import.meta.env.VITE_API_BASE_URL as string | undefined;

    // Validate backend URL is configured
    if (!backendUrl || typeof backendUrl !== 'string') {
      return null;
    }

    // Remove any trailing slashes from backend URL
    const cleanBackendUrl = backendUrl.replace(/\/+$/u, '');
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

  const handleRetry = (): void => {
    setStatus('loading');
    setRetryCount((c) => c + RETRY_STEP);
  };

  useEffect(() => {
    if (!voilaUrl || !voilaOrigin) return undefined;

    setStatus('loading');
  }, [voilaUrl]);

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
