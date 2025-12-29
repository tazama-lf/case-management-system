import React, { useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import alertNavigatorService from './services';
import type { AlertNavigatorDto, TypologyDto } from './types';

interface AlertNavigatorTabProps {
  alertId?: string;
  caseId?: string;
  transactionId?: string;
}

const AlertNavigatorTab: React.FC<AlertNavigatorTabProps> = ({
  alertId,
  caseId: _caseId,
  transactionId: _transactionId,
}) => {
  const [data, setData] = React.useState<AlertNavigatorDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedTypologies, setExpandedTypologies] = React.useState<Set<string>>(new Set());

  useEffect(() => {
    if (!alertId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await alertNavigatorService.getAlertNavigator(alertId);
        setData(result);
        if (result.typologies.length > 0) {
          setExpandedTypologies(new Set([result.typologies[0].id]));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [alertId]);

  const toggleTypology = (typologyId: string) => {
    setExpandedTypologies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typologyId)) {
        newSet.delete(typologyId);
      } else {
        newSet.add(typologyId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 80) return 'text-red-700';
    if (score >= 60) return 'text-orange-700';
    return 'text-yellow-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!alertId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Select an alert to view navigator details</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Alert Navigator</h3>
        <span className="inline-flex items-center rounded-md px-3 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
          {data.status || 'PENDING'}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Alert ID: {data.alertId}
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Alert Metadata</h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Alert ID</div>
            <div className="text-sm font-medium text-gray-900">{data.alertId}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Timestamp</div>
            <div className="text-sm font-medium text-gray-900">
              {new Date(data.timestamp).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Transaction Type</div>
            <div className="text-sm font-medium text-gray-900">{data.transactionType}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Amount</div>
            <div className="text-sm font-medium text-gray-900">
              {data.amount.value} {data.amount.currency}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Transaction ID</div>
            <div className="text-sm font-medium text-gray-900">{data.transactionId}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Reason</div>
            <div className="text-sm text-gray-900">{data.reason}</div>
          </div>
          {data.blockStatus && (
            <div className="col-span-2">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Block Status</div>
              <div className="text-sm text-gray-900">
                {data.blockStatus.status} - {data.blockStatus.reason}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Triggered Typologies</h4>
        <div className="space-y-3">
          {data.typologies.length > 0 ? (
            data.typologies.map((typology: TypologyDto) => (
              <div key={typology.id} className="rounded-lg border border-gray-200 bg-gray-50">
                <button
                  onClick={() => toggleTypology(typology.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {expandedTypologies.has(typology.id) ? (
                      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                    )}
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          typology.score >= 80
                            ? 'bg-red-500'
                            : typology.score >= 60
                            ? 'bg-orange-500'
                            : 'bg-yellow-500'
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900">{typology.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold ${getScoreTextColor(
                        typology.score,
                      )}`}
                    >
                      Score: {typology.score.toFixed(2)}
                    </span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getScoreColor(typology.score)}`}
                        style={{ width: `${Math.min(typology.score, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
                {expandedTypologies.has(typology.id) && (
                  <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3 bg-white">
                    {typology.rules.length > 0 ? (
                      typology.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          </div>
                          <div>
                            <div className="text-sm text-gray-900">{rule.id}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Weight: {(rule.weight * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No rules</div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 py-4">No typologies triggered</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Typologies Triggered
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">{data.typologies.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Rules Extracted
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">{data.rules.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Avg Score
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {data.typologies.length > 0
                ? (data.typologies.reduce((sum, t) => sum + t.score, 0) / data.typologies.length).toFixed(0)
                : '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertNavigatorTab;
