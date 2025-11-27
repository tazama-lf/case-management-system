import { AlertType } from '@prisma/client-cms';

export interface AIPrediction {
  priority: number;
  confidence: number;
}

export interface Prediction {
  priorityScore: number;
  confidence_per: number;
  alertType: AlertType;
  isTruePositive: boolean;
}
