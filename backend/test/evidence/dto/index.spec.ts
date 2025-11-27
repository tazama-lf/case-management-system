import * as EvidenceDto from '../../../src/evidence/dto/index';

describe('Evidence DTO index', () => {
  it('should export UploadEvidenceDto and EvidenceResponseDto', () => {
    expect(EvidenceDto.UploadEvidenceDto).toBeDefined();
    expect(EvidenceDto.EvidenceResponseDto).toBeDefined();
  });

  it('should export EvidenceType enum', () => {
    expect(EvidenceDto.EvidenceType).toBeDefined();
    expect(EvidenceDto.EvidenceType.KYC).toBe('KYC');
  });
});
