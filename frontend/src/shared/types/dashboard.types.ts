import type React from 'react';

export interface DashboardStats {
  label: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
}

export interface Alert {
  id: string;
  type: 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS';
  createdAt: string;
  confidence: number;
}

export interface Case {
  id: string;
  title: string;
  type: 'FRAUD' | 'MONEY_LAUNDERING';
  status: 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignee: string;
  createdAt: string;
  alertsCount: number;
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS';
export type CaseStatus = 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
export type AlertType = 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
export type CaseType = 'FRAUD' | 'MONEY_LAUNDERING';
