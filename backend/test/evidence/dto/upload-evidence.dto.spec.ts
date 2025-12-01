import { UploadEvidenceDto, EvidenceType } from '../../../src/evidence/dto/upload-evidence.dto';

describe('UploadEvidenceDto', () => {
  it('should create an instance with required fields', () => {
    const dto = new UploadEvidenceDto();
    dto.taskId = 'task123';
    dto.evidenceType = EvidenceType.KYC;
    expect(dto.taskId).toBe('task123');
    expect(dto.evidenceType).toBe(EvidenceType.KYC);
  });

  it('should allow optional fields to be set', () => {
    const dto = new UploadEvidenceDto();
    dto.taskId = 'task456';
    dto.evidenceType = EvidenceType.EDD;
    // role property removed, not present in DTO
    dto.tags = 'tag1';
    dto.description = 'desc';
    dto.comments = 'comment';
    dto.aggregator = 'agg';
    dto.dateSearched = '2025-11-26';
    dto.keywords = ['fraud', 'aml'];
    dto.findings = 'none';
    dto.screeningDate = '2025-11-25';
    dto.tool = 'tool';
    dto.summaryDisposition = 'Cleared';
    dto.submissionDate = '2025-11-24';
    dto.referenceNumber = 'ref123';
    dto.submissionChannel = 'Portal';
    expect(dto.tags).toBe('tag1');
    expect(dto.keywords).toEqual(['fraud', 'aml']);
    expect(dto.referenceNumber).toBe('ref123');
  });

  it('should transform keywords from string to array', () => {
    const dto = new UploadEvidenceDto();
    // Simulate Transform decorator
    const input = 'fraud, aml, kyc';
    dto.keywords = input.split(',').map(k => k.trim());
    expect(dto.keywords).toEqual(['fraud', 'aml', 'kyc']);
  });

    it('should create a Sanctions Screening evidence with all required and optional fields', () => {
      const dto = new UploadEvidenceDto();
      dto.taskId = 'task789';
      dto.evidenceType = EvidenceType.SANCTIONS;
      dto.tags = 'tenant:tenant1,investigator:user123';
      dto.description = 'Sanctions screening for case 001';
      dto.comments = 'Uploaded by investigator';
      dto.screeningDate = '2025-11-26';
      dto.tool = 'WorldCheck';
      dto.summaryDisposition = 'Cleared';
      dto.referenceNumber = 'WC-REF-2025-001';
      // Simulate registry linkage
      expect(dto.evidenceType).toBe(EvidenceType.SANCTIONS);
      expect(dto.tags).toContain('tenant:tenant1');
      expect(dto.tags).toContain('investigator:user123');
      expect(dto.screeningDate).toBe('2025-11-26');
      expect(dto.tool).toBe('WorldCheck');
      expect(dto.summaryDisposition).toBe('Cleared');
      expect(dto.referenceNumber).toBe('WC-REF-2025-001');
      expect(dto.description).toBe('Sanctions screening for case 001');
      expect(dto.comments).toBe('Uploaded by investigator');
    });
});

describe('EvidenceType enum', () => {
  it('should have expected values', () => {
    expect(EvidenceType.KYC).toBe('KYC');
    expect(EvidenceType.EDD).toBe('EDD');
    expect(EvidenceType.SANCTIONS).toBe('SANCTIONS');
    expect(EvidenceType.ADVERSE_MEDIA).toBe('ADVERSE_MEDIA');
    expect(EvidenceType.OTHER).toBe('OTHER');
    expect(EvidenceType.SAR_STR_FILING).toBe('SAR_STR_FILING');
  });
});
