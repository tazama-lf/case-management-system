import React from 'react';
import {
  useSystemConfig,
  getTriageModeLabel,
  getTriageModeDescription,
  getTriageModeColor,
} from '../../../shared/hooks/useSystemConfig';
import {
  CpuChipIcon,
  UserIcon,
  ForwardIcon,
} from '@heroicons/react/24/outline';
import type { TriageType } from '../../../shared/services/systemConfigService';

interface TriageModeIndicatorProps {
  className?: string;
  showDescription?: boolean;
  compact?: boolean;
}

const getTriageModeIcon = (triageType: TriageType) => {
  switch (triageType) {
    case 'AI':
      return <CpuChipIcon className="h-4 w-4" />;
    case 'MANUAL':
      return <UserIcon className="h-4 w-4" />;
    case 'DISABLED':
      return <ForwardIcon className="h-4 w-4" />;
    default: {
      const _exhaustiveCheck: never = triageType;
      return _exhaustiveCheck;
    }
  }
};

export const TriageModeIndicator: React.FC<TriageModeIndicatorProps> = ({
  className = '',
  showDescription = false,
  compact = false,
}) => {
  const { config, loading, triageType } = useSystemConfig();

  if (loading || !config) {
    return (
      <div
        className={`animate-pulse bg-gray-200 rounded-md h-6 w-32 ${className}`}
      />
    );
  }

  const colorClasses = getTriageModeColor(triageType);
  const label = getTriageModeLabel(triageType);
  const description = getTriageModeDescription(triageType);
  const icon = getTriageModeIcon(triageType);

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${colorClasses} ${className}`}
        title={description}
      >
        {icon}
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${colorClasses}`}
      >
        {icon}
        <span>{label}</span>
      </div>
      {showDescription && (
        <p className="text-xs text-gray-600 max-w-xs">{description}</p>
      )}
    </div>
  );
};

export default TriageModeIndicator;
