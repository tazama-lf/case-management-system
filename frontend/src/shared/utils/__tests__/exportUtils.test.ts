import { formatDataForExport, getColumnsForReport } from '../exportUtils';

describe('exportUtils helpers', () => {
  it('formats generic data correctly', () => {
    const data = [{ id: 1, name: 'A' }];
    const formatted = formatDataForExport(data, 'UNKNOWN');
    expect(Array.isArray(formatted)).toBe(true);
    expect(formatted[0]).toHaveProperty('id');
    expect(formatted[0]).toHaveProperty('name');
  });

  it('formats CASE_STATUS report', () => {
    const data = [{ status: 'S', count: 2, percentage: '50%' }];
    const formatted = formatDataForExport(data, 'CASE_STATUS');
    expect(formatted[0]).toHaveProperty('Status');
    expect(formatted[0]).toHaveProperty('Count');
  });

  it('returns columns for reports', () => {
    const cols = getColumnsForReport('CASE_STATUS');
    expect(Array.isArray(cols)).toBe(true);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols[0]).toHaveProperty('key');
    expect(cols[0]).toHaveProperty('label');
  });
});
