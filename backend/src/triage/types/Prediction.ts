// import { AlertType } from '@prisma/client';

export enum AlertType {
  FRAUD = 'FRAUD',
  AML = 'AML',
  FRAUD_AND_AML = 'FRAUD_AND_AML',
  NONE = 'NONE',
  SUSPICIOUS = 'SUSPICIOUS',
  INFO = 'INFO',
}

export interface Prediction {
  priorityScore: number;
  alertType: AlertType;
  confidence_per: number;
  isTruePositive: boolean;
}
