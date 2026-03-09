import type { CaseType } from '@prisma/client-cms';

export interface AIPrediction {
  priority: number;
  confidence: number;
}

export interface Prediction {
  priorityScore: number;
  confidence_per: number;
  alertType: CaseType;
  isTruePositive: boolean;
}
