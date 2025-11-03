import { AlertType } from '@prisma/client';

export interface Prediction {
  priorityScore?: number;
  alertType: AlertType;
  confidence_per: number;
  isTruePositive: boolean;
}
