import React from 'react';
import type { SlaState } from '@/features/alerts/types/triage.types';

export const getSlaStateColor = (slaState?: string | null): string => {
  const slaStateColors: Record<string, string> = {
    ON_TRACK: 'bg-green-50 text-green-700 ring-green-200',
    AT_RISK: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    DUE_SOON: 'bg-amber-50 text-amber-700 ring-amber-200',
    BREACHED: 'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    (slaState ? slaStateColors[slaState] : undefined) ??
    'bg-gray-50 text-gray-700 ring-gray-200'
  );
};

export const formatSlaState = (slaState?: string | null): string => {
  const slaStateLabels: Record<string, string> = {
    ON_TRACK: 'On Track',
    AT_RISK: 'At Risk',
    DUE_SOON: 'Due Soon',
    BREACHED: 'Breached',
  };
  return (slaState ? slaStateLabels[slaState] : undefined) ?? 'N/A';
};

interface SlaStateBadgeProps {
  slaState?: SlaState | null;
  className?: string;
}

const SlaStateBadge: React.FC<SlaStateBadgeProps> = ({
  slaState,
  className = '',
}) => (
  <span
    className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getSlaStateColor(slaState)} ${className}`}
  >
    {formatSlaState(slaState)}
  </span>
);

export default SlaStateBadge;
