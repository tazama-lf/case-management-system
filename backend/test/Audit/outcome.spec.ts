import { Outcome } from '../../src/utils/types/outcome';

describe('Outcome Enum', () => {
  it('should have SUCCESS and FAILURE values', () => {
    expect(Outcome.SUCCESS).toBe('SUCCESS');
    expect(Outcome.FAILURE).toBe('FAILURE');
  });

  it('should not have other values', () => {
    expect(Object.keys(Outcome)).toEqual(['SUCCESS', 'FAILURE']);
  });
});
