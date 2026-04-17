import React, { useEffect } from 'react';
import ErrorState from '@/shared/components/ui/ErrorState';
import LoadingSpinner from '@/shared/components/ui/LoadingSpinner';

interface VoilaFrameProps {
  notebookPath: string;
  title: string;
  queryParams?: Record<string, string>;
}

/**
 * Renders a Voila notebook inside an iframe.
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
}) => {
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = React.useState(0);

  const voilaUrl = React.useMemo(() => {
    const base = import.meta.env.VITE_VOILA_BASE_URL;
    // Must be an absolute HTTP(S) URL. Any other value (undefined, empty, a
    // relative path) would silently resolve to the CMS origin.
    if (!base || typeof base !== 'string' || !/^https?:\/\//i.test(base)) {
      return null;
    }
    const url = new URL(`/voila/render/${notebookPath}`, base);
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) =>
        url.searchParams.set(k, v),
      );
    }
    return url.toString();
  }, [notebookPath, queryParams]);

  const handleRetry = () => {
    setStatus('loading');
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    setStatus('loading');
  }, [voilaUrl]);

  if (!voilaUrl) {
    return (
      <div className="flex h-[750px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="w-full max-w-md">
          <ErrorState
            severity="warning"
            title="Visualization Unavailable"
            message="The network visualization service is not configured. Please set VITE_VOILA_BASE_URL to a valid absolute URL and restart the application."
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
              message="The visualization could not be loaded. The Voila server may be unavailable or unreachable. Please try again or contact your system administrator."
              showRetry
              onRetry={handleRetry}
              size="large"
            />
          </div>
        </div>
      )}

      <iframe
        key={`${voilaUrl}-${retryCount}`}
        src={voilaUrl}
        className={`h-full w-full rounded-lg border-0${status !== 'loaded' ? ' invisible' : ''}`}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

export default VoilaFrame;
