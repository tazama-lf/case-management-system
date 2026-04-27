import { describe, it, expect } from 'vitest';
import {
  transactionNetworkLegend,
  accountNetworkLegend,
  counterpartyNetworkLegend,
} from '../network-analysis/legendConfigs';

describe('legendConfigs', () => {
  it('transactionNetworkLegend has correct items', () => {
    expect(transactionNetworkLegend).toHaveLength(5);
    expect(transactionNetworkLegend[0].label).toBe('Alert Triggered');
    expect(transactionNetworkLegend[0].type).toBe('circle');
  });

  it('accountNetworkLegend has correct items', () => {
    expect(accountNetworkLegend).toHaveLength(4);
    expect(accountNetworkLegend[0].label).toBe('Counterparty');
  });

  it('counterpartyNetworkLegend has correct items', () => {
    expect(counterpartyNetworkLegend).toHaveLength(4);
    expect(counterpartyNetworkLegend[0].label).toBe('Primary Counterparty');
  });

  it('all legend items have required fields', () => {
    const allItems = [
      ...transactionNetworkLegend,
      ...accountNetworkLegend,
      ...counterpartyNetworkLegend,
    ];
    allItems.forEach((item) => {
      expect(item.color).toBeDefined();
      expect(item.label).toBeDefined();
      expect(['circle', 'line']).toContain(item.type);
    });
  });
});
