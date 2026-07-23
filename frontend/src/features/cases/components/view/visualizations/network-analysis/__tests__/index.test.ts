import { describe, it, expect } from 'vitest';
import * as networkAnalysis from '../index';

describe('network-analysis index barrel exports', () => {
  it('should export TransactionNetworkTab', () => {
    expect(networkAnalysis.TransactionNetworkTab).toBeDefined();
  });

  it('should export AccountNetworkTab', () => {
    expect(networkAnalysis.AccountNetworkTab).toBeDefined();
  });

  it('should export CounterpartyNetworkTab', () => {
    expect(networkAnalysis.CounterpartyNetworkTab).toBeDefined();
  });

  it('should export TimeSlider', () => {
    expect(networkAnalysis.TimeSlider).toBeDefined();
  });

  it('should export NetworkGraph', () => {
    expect(networkAnalysis.NetworkGraph).toBeDefined();
  });

  it('should export NetworkLegend', () => {
    expect(networkAnalysis.NetworkLegend).toBeDefined();
  });

  it('should export NetworkDetailsPanel', () => {
    expect(networkAnalysis.NetworkDetailsPanel).toBeDefined();
  });

  it('should export mock data generators', () => {
    expect(networkAnalysis.generateTransactionNetworkNodes).toBeDefined();
    expect(networkAnalysis.generateTransactionNetworkEdges).toBeDefined();
    expect(networkAnalysis.generateAccountNetworkNodes).toBeDefined();
    expect(networkAnalysis.generateAccountNetworkEdges).toBeDefined();
    expect(networkAnalysis.generateCounterpartyNetworkNodes).toBeDefined();
    expect(networkAnalysis.generateCounterpartyNetworkEdges).toBeDefined();
  });
});
