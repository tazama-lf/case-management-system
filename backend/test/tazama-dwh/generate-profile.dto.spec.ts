import { GenerateProfileDto } from '../../src/tazama-dwh/dto/generate-profile.dto';

describe('GenerateProfileDto', () => {
  it('should create an instance with required tenantId', () => {
    const dto = new GenerateProfileDto();
    dto.tenantId = 'T001';
    expect(dto.tenantId).toBe('T001');
  });

  it('should allow optional filters', () => {
    const dto = new GenerateProfileDto();
    dto.tenantId = 'T001';
    dto.filters = { type: 'Withdrawal', creditorId: 'Retail Store LLC' };
    expect(dto.filters?.type).toBe('Withdrawal');
    expect(dto.filters?.creditorId).toBe('Retail Store LLC');
  });

  it('should allow optional notes', () => {
    const dto = new GenerateProfileDto();
    dto.tenantId = 'T001';
    dto.notes = 'Test notes';
    expect(dto.notes).toBe('Test notes');
  });
});
