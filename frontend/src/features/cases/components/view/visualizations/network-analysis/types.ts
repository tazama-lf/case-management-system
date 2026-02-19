/**
 * Network Analysis Types
 * Types for network visualization data structures
 */

export interface NetworkNode {
  id: string;
  label: string;
  type: 'account' | 'counterparty' | 'transaction';
  value?: number;
  flagged?: boolean;
  investigationStatus?: 'active' | 'previous' | 'none';
  metadata?: Record<string, unknown>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  value: number;
  volume?: number;
  timestamp: string;
  alertStatus?: 'flagged' | 'suspicious' | 'clean';
  transactionType?: 'inbound' | 'outbound';
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface TransactionFlow {
  id: string;
  accountId: string;
  counterpartyId: string;
  amount: number;
  currency: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  alertStatus?: 'flagged' | 'suspicious' | 'clean';
  investigationFlag?: boolean;
}

export interface AccountNetworkData {
  accountId: string;
  accountName: string;
  linkedAccounts: Array<{
    id: string;
    name: string;
    transactionVolume: number;
    transactionFrequency: number;
    alertStatus?: 'flagged' | 'suspicious' | 'clean';
    lastTransactionDate: string;
  }>;
}

export interface CounterpartyNetworkData {
  transactionId: string;
  counterparties: Array<{
    id: string;
    name: string;
    transactionValue: number;
    frequency: number;
    alertStatus?: 'flagged' | 'suspicious' | 'clean';
    timestamp: string;
  }>;
}

export type TimeRange = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface TimeSliderConfig {
  range: TimeRange;
  startDate: Date;
  endDate: Date;
}
