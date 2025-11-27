import { describe, it, expect } from 'vitest';
import {
  DATE_RANGE_OPTIONS,
  REPORT_TYPE_OPTIONS,
  CASE_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
  TRIAGE_TYPE_OPTIONS,
  SORT_OPTIONS,
  EXPORT_ACTIONS,
  REPORT_TABLE_HEADERS,
  WORK_QUEUE_TABLE_HEADERS,
  AUDIT_LOG_FILTER_FIELDS,
  DATE_RANGE_LABELS,
  REPORT_TYPE_LABELS,
} from '../options';

describe('options', () => {
  it('exports DATE_RANGE_OPTIONS with correct structure', () => {
    expect(DATE_RANGE_OPTIONS).toBeDefined();
    expect(Array.isArray(DATE_RANGE_OPTIONS)).toBe(true);
    expect(DATE_RANGE_OPTIONS.length).toBeGreaterThan(0);
    expect(DATE_RANGE_OPTIONS[0]).toHaveProperty('value');
    expect(DATE_RANGE_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports REPORT_TYPE_OPTIONS with correct structure', () => {
    expect(REPORT_TYPE_OPTIONS).toBeDefined();
    expect(Array.isArray(REPORT_TYPE_OPTIONS)).toBe(true);
    expect(REPORT_TYPE_OPTIONS[0]).toHaveProperty('value');
    expect(REPORT_TYPE_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports CASE_TYPE_OPTIONS with correct structure', () => {
    expect(CASE_TYPE_OPTIONS).toBeDefined();
    expect(Array.isArray(CASE_TYPE_OPTIONS)).toBe(true);
    expect(CASE_TYPE_OPTIONS[0]).toHaveProperty('value');
    expect(CASE_TYPE_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports TASK_STATUS_OPTIONS with correct structure', () => {
    expect(TASK_STATUS_OPTIONS).toBeDefined();
    expect(Array.isArray(TASK_STATUS_OPTIONS)).toBe(true);
    expect(TASK_STATUS_OPTIONS[0]).toHaveProperty('value');
    expect(TASK_STATUS_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports TRIAGE_TYPE_OPTIONS with correct structure', () => {
    expect(TRIAGE_TYPE_OPTIONS).toBeDefined();
    expect(Array.isArray(TRIAGE_TYPE_OPTIONS)).toBe(true);
    expect(TRIAGE_TYPE_OPTIONS[0]).toHaveProperty('value');
    expect(TRIAGE_TYPE_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports SORT_OPTIONS with correct structure', () => {
    expect(SORT_OPTIONS).toBeDefined();
    expect(Array.isArray(SORT_OPTIONS)).toBe(true);
    expect(SORT_OPTIONS[0]).toHaveProperty('value');
    expect(SORT_OPTIONS[0]).toHaveProperty('label');
  });

  it('exports EXPORT_ACTIONS with correct structure', () => {
    expect(EXPORT_ACTIONS).toBeDefined();
    expect(Array.isArray(EXPORT_ACTIONS)).toBe(true);
    expect(EXPORT_ACTIONS[0]).toHaveProperty('type');
    expect(EXPORT_ACTIONS[0]).toHaveProperty('label');
  });

  it('exports REPORT_TABLE_HEADERS as array', () => {
    expect(REPORT_TABLE_HEADERS).toBeDefined();
    expect(Array.isArray(REPORT_TABLE_HEADERS)).toBe(true);
    expect(REPORT_TABLE_HEADERS.length).toBeGreaterThan(0);
  });

  it('exports WORK_QUEUE_TABLE_HEADERS as array', () => {
    expect(WORK_QUEUE_TABLE_HEADERS).toBeDefined();
    expect(Array.isArray(WORK_QUEUE_TABLE_HEADERS)).toBe(true);
    expect(WORK_QUEUE_TABLE_HEADERS.length).toBeGreaterThan(0);
  });

  it('exports AUDIT_LOG_FILTER_FIELDS with correct structure', () => {
    expect(AUDIT_LOG_FILTER_FIELDS).toBeDefined();
    expect(Array.isArray(AUDIT_LOG_FILTER_FIELDS)).toBe(true);
    expect(AUDIT_LOG_FILTER_FIELDS[0]).toHaveProperty('key');
    expect(AUDIT_LOG_FILTER_FIELDS[0]).toHaveProperty('label');
    expect(AUDIT_LOG_FILTER_FIELDS[0]).toHaveProperty('type');
  });

  it('exports DATE_RANGE_LABELS as record', () => {
    expect(DATE_RANGE_LABELS).toBeDefined();
    expect(typeof DATE_RANGE_LABELS).toBe('object');
    expect(DATE_RANGE_LABELS.today).toBe('Today');
  });

  it('exports REPORT_TYPE_LABELS as record', () => {
    expect(REPORT_TYPE_LABELS).toBeDefined();
    expect(typeof REPORT_TYPE_LABELS).toBe('object');
    expect(REPORT_TYPE_LABELS.CASE_STATUS).toBe('Case Status Report');
  });
});

