import * as transformers from '../../utils/alertTransformers';
import { describe, it, expect, vi } from 'vitest';

describe('alertTransformers basic utilities', () => {
  it('maps severity to priority and UI status to backend status', () => {
    expect(transformers.mapSeverityToPriority('low')).toBe('NEW');
    expect(transformers.mapSeverityToPriority('medium')).toBe('URGENT');
    expect(transformers.mapSeverityToPriority('high')).toBe('CRITICAL');
    expect(transformers.mapSeverityToPriority('critical')).toBe('BREACH');

    expect(transformers.mapUIStatusToAlertStatus('new')).toBe('NEW');
    expect(transformers.mapUIStatusToAlertStatus('investigating')).toBe(
      'INVESTIGATING',
    );
    expect(transformers.mapUIStatusToAlertStatus('closed')).toBe('CLOSED');
  });

  it('transforms backend alert to ui and back', () => {
    const backendAlert: any = {
      alert_id: 'a1',
      tenant_id: 't1',
      priority: 'NEW',
      alert_type: 'AML',
      source: 's1',
      txtp: 'pacs',
      message: 'Test',
      alert_data: { tadpResult: { typologyResult: [{ result: 42 }] } },
      transaction: { transactionId: 'tx1', amount: 100, currency: 'EUR' },
      network_map: null,
      confidence_per: 50,
      created_at: '2020-01-01',
      case_id: null,
    };

    const ui = transformers.transformBackendAlertToUI(backendAlert as any);
    expect(ui.alert_id).toBe('a1');
    expect(ui.type).toBe('AML');
    expect(ui.riskScore).toBeGreaterThanOrEqual(0);

    const back = transformers.transformUIAlertToBackend(ui);
    expect(back.alert_id).toBe('a1');
    expect(back.priority).toBe('NEW');
  });
});
