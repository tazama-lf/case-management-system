import { describe, it, expect } from 'vitest';
import * as VisualizationsExports from '../index';

describe('visualizations index barrel exports', () => {
  it('exports AlertNavigatorTab', () => {
    expect(VisualizationsExports.AlertNavigatorTab).toBeDefined();
  });

  it('exports alertNavigatorService', () => {
    expect(VisualizationsExports.alertNavigatorService).toBeDefined();
  });

  it('exports AlertHistoryTab', () => {
    expect(VisualizationsExports.AlertHistoryTab).toBeDefined();
  });

  it('exports ConditionsTab', () => {
    expect(VisualizationsExports.ConditionsTab).toBeDefined();
  });

  it('exports TransactionDetailsTab', () => {
    expect(VisualizationsExports.TransactionDetailsTab).toBeDefined();
  });

  it('exports TransactionHistoryTab', () => {
    expect(VisualizationsExports.TransactionHistoryTab).toBeDefined();
  });

  it('exports NetworkAnalysisTab', () => {
    expect(VisualizationsExports.NetworkAnalysisTab).toBeDefined();
  });
});
