import React, { useEffect, useState } from 'react';
import apiClient from '@/shared/services/apiClient';

interface JupyterVisualizationProps {
  notebook: string;
  params: Record<string, string>;
  height?: string;
  title?: string;
}

const JupyterVisualization: React.FC<JupyterVisualizationProps> = ({
  notebook,
  params,
  height = '600px',
  title = 'Visualization',
}) => {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query params
      const queryParams = new URLSearchParams({
        notebook,
        ...params,
      });

      const response = await apiClient.get<{ url: string }>(
        `/api/v1/jupyter/visualization-url?${queryParams.toString()}`,
      );

      console.log('response================', response.url);

      setIframeUrl(response.url);
    } catch (err) {
      console.error('Failed to fetch Jupyter URL:', err);
      setError('Failed to load visualization configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrl();
  }, [notebook, JSON.stringify(params)]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-sm text-gray-500">Loading visualization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg"
        style={{ height }}
      >
        <div className="text-center p-6">
          <h3 className="text-sm font-medium text-red-800 mb-2">
            Error Loading Visualization
          </h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchUrl}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-1">
        <h4 className="text-sm font-medium text-gray-500"></h4>
        <button
          onClick={fetchUrl}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Refresh
        </button>
      </div>
      <div className="relative w-full h-full border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {iframeUrl && (
          <iframe
            src={iframeUrl}
            width="100%"
            height={height}
            className="border-0"
            title={title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => { setError('Failed to load iframe content'); }}
          />
        )}
      </div>
    </div>
  );
};

export default JupyterVisualization;
