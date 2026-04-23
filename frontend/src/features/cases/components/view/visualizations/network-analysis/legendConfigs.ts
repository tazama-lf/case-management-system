/**
 * Legend configuration for network visualizations
 */

export interface LegendItem {
  color: string;
  ringColor?: string;
  label: string;
  type: 'circle' | 'line';
  lineStyle?: 'solid' | 'dashed';
  hasArrow?: boolean;
}

export const transactionNetworkLegend: LegendItem[] = [
  {
    color: '#EF4444',
    ringColor: '#EF4444',
    label: 'Alert Triggered',
    type: 'circle',
  },
  { color: '#6366F1', label: 'Normal Account', type: 'circle' },
  {
    color: '#F59E0B',
    ringColor: '#F59E0B',
    label: 'Under Investigation',
    type: 'circle',
  },
  {
    color: '#F472B6',
    label: 'Outbound Flow',
    type: 'line',
    lineStyle: 'dashed',
    hasArrow: true,
  },
  {
    color: '#60A5FA',
    label: 'Inbound Flow',
    type: 'line',
    lineStyle: 'dashed',
    hasArrow: true,
  },
];

export const accountNetworkLegend: LegendItem[] = [
  { color: '#818CF8', label: 'Counterparty', type: 'circle' },
  {
    color: '#FEE2E2',
    ringColor: '#EF4444',
    label: 'Account with Alert',
    type: 'circle',
  },
  { color: '#6366F1', label: 'Normal Account', type: 'circle' },
  {
    color: '#F59E0B',
    ringColor: '#F59E0B',
    label: 'Under Investigation',
    type: 'circle',
  },
];

export const counterpartyNetworkLegend: LegendItem[] = [
  { color: '#818CF8', label: 'Primary Counterparty', type: 'circle' },
  {
    color: '#FEE2E2',
    ringColor: '#EF4444',
    label: 'High Risk',
    type: 'circle',
  },
  {
    color: '#FEF3C7',
    ringColor: '#F59E0B',
    label: 'Medium Risk',
    type: 'circle',
  },
  { color: '#6366F1', label: 'Low Risk', type: 'circle' },
];
