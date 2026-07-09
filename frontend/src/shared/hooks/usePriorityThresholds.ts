import { useEffect, useState } from 'react';
import { caseService } from '@/features/cases/services/caseService';
import {
  FALLBACK_HIGH_THRESHOLD,
  FALLBACK_MEDIUM_THRESHOLD,
} from '@/shared/constants/casePriorityThresholds';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PriorityThresholds {
  highThreshold: number;
  mediumThreshold: number;
}

export const usePriorityThresholds = (
  active: boolean,
): {
  thresholds: PriorityThresholds;
  calculatePriority: (score: number) => Priority;
} => {
  const [thresholds, setThresholds] = useState<PriorityThresholds>({
    highThreshold: FALLBACK_HIGH_THRESHOLD,
    mediumThreshold: FALLBACK_MEDIUM_THRESHOLD,
  });

  useEffect(() => {
    if (!active) return;

    let isMounted = true;
    caseService
      .getPriorityThresholds()
      .then((result) => {
        if (isMounted) setThresholds(result);
      })
      .catch((error: unknown) => {
        console.error(
          'Failed to load priority thresholds, using defaults:',
          error,
        );
      });

    return () => {
      isMounted = false;
    };
  }, [active]);

  const calculatePriority = (score: number): Priority => {
    if (score >= thresholds.highThreshold) return 'HIGH';
    if (score >= thresholds.mediumThreshold) return 'MEDIUM';
    return 'LOW';
  };

  return { thresholds, calculatePriority };
};
