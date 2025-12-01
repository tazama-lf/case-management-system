import { EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto } from '../../../src/evidence/dto/evidence-response.dto';
import { EvidenceType } from '../../../src/evidence/dto/upload-evidence.dto';

describe('EvidenceResponseDto', () => {
  it('should create an instance with all required fields', () => {
    const dto = new EvidenceResponseDto();
    dto.id = 'ev1';
    dto.taskId = 'task123';
    dto.fileName = 'file1.pdf';
    dto.evidenceType = EvidenceType.KYC;
    dto.fileSize = 1234;
    dto.attachments = [];
    dto.mimeType = 'application/pdf';
    dto.hash = 'hash';
    dto.uploadedBy = 'user1';
    dto.uploadedAt = new Date('2025-11-26T00:00:00Z');
    dto.archive = false;
    dto.tags = 'tag1';
    dto.description = 'desc';
    dto.comments = 'comment';
    dto.couchdbRev = '1-abc';
    expect(dto).toMatchObject({
      id: 'ev1',
      taskId: 'task123',
      fileName: 'file1.pdf',
      evidenceType: EvidenceType.KYC,
      fileSize: 1234,
      attachments: [],
      mimeType: 'application/pdf',
      hash: 'hash',
      uploadedBy: 'user1',
      uploadedAt: new Date('2025-11-26T00:00:00Z'),
      archive: false,
      tags: 'tag1',
      description: 'desc',
      comments: 'comment',
      couchdbRev: '1-abc',
    });
  });

  it('should allow optional fields to be undefined', () => {
    const dto = new EvidenceResponseDto();
    dto.id = 'ev2';
    dto.taskId = 'task456';
    dto.fileName = 'file2.pdf';
    dto.evidenceType = EvidenceType.OTHER;
    dto.fileSize = 5678;
    dto.attachments = [];
    dto.mimeType = 'application/pdf';
    dto.hash = 'hash2';
    dto.uploadedBy = 'user2';
    dto.uploadedAt = new Date('2025-11-26T00:00:00Z');
    dto.archive = true;
    expect(dto.tags).toBeUndefined();
    expect(dto.description).toBeUndefined();
    expect(dto.comments).toBeUndefined();
    expect(dto.couchdbRev).toBeUndefined();
  });
});

describe('EvidenceListResponseDto', () => {
  it('should create an instance with evidence array and total', () => {
    const evidence = [new EvidenceResponseDto(), new EvidenceResponseDto()];
    const dto = new EvidenceListResponseDto();
    dto.evidence = evidence;
    dto.total = 2;
    dto.taskId = 'task123';
    dto.evidenceType = EvidenceType.KYC;
    expect(dto.evidence.length).toBe(2);
    expect(dto.total).toBe(2);
    expect(dto.taskId).toBe('task123');
    expect(dto.evidenceType).toBe(EvidenceType.KYC);
  });
});

describe('Adverse Media Screening Evidence', () => {
  it('should create evidence with aggregator, date searched, keywords, and findings', () => {
    const dto = new EvidenceResponseDto();
    dto.id = 'ev_adverse_1';
    dto.taskId = 'task123';
    dto.fileName = 'adverse_report.pdf';
    dto.evidenceType = EvidenceType.ADVERSE_MEDIA;
    dto.fileSize = 2048;
    dto.attachments = [];
    dto.mimeType = 'application/pdf';
    dto.hash = 'hash123';
    dto.uploadedBy = 'investigator1';
    dto.uploadedAt = new Date('2025-10-10T10:00:00Z');
    dto.archive = false;
    dto.tags = 'aggregator:LexisNexis,date:2025-10-10,keywords:fraud,aml';
    dto.description = 'Negative article found on 10-Oct-2025';
    dto.comments = 'Reviewed by compliance';
    dto.couchdbRev = '1-xyz';
    expect(dto).toMatchObject({
      id: 'ev_adverse_1',
      taskId: 'task123',
      fileName: 'adverse_report.pdf',
      evidenceType: EvidenceType.ADVERSE_MEDIA,
      fileSize: 2048,
      attachments: [],
      mimeType: 'application/pdf',
      hash: 'hash123',
      uploadedBy: 'investigator1',
      uploadedAt: new Date('2025-10-10T10:00:00Z'),
      archive: false,
      tags: 'aggregator:LexisNexis,date:2025-10-10,keywords:fraud,aml',
      description: 'Negative article found on 10-Oct-2025',
      comments: 'Reviewed by compliance',
      couchdbRev: '1-xyz',
    });
  });

  it('should allow remarks summarizing key findings', () => {
    const dto = new EvidenceResponseDto();
    dto.description = 'No relevant results';
    expect(dto.description).toBe('No relevant results');
  });

  it('should allow aggregator/source details and search metadata in tags', () => {
    const dto = new EvidenceResponseDto();
    dto.tags = 'aggregator:LexisNexis,date:2025-10-10,keywords:fraud,aml';
    expect(dto.tags).toContain('aggregator:LexisNexis');
    expect(dto.tags).toContain('date:2025-10-10');
    expect(dto.tags).toContain('keywords:fraud,aml');
  });
});

describe('Sanctions Screening Evidence', () => {
  it('should create evidence with all required and optional sanctions fields', () => {
    const dto = new EvidenceResponseDto();
    dto.id = 'ev_sanctions_1';
    dto.taskId = 'task789';
    dto.fileName = 'sanctions_report.pdf';
    dto.evidenceType = EvidenceType.SANCTIONS;
    dto.fileSize = 4096;
    dto.attachments = [];
    dto.mimeType = 'application/pdf';
    dto.hash = 'hash789';
    dto.uploadedBy = 'user123';
    dto.uploadedAt = new Date('2025-11-26T12:00:00Z');
    dto.archive = false;
    dto.tags = 'tenant:tenant1,investigator:user123';
    dto.description = 'Sanctions screening for case 001';
    dto.comments = 'Screening completed and uploaded';
    dto.couchdbRev = '1-sanctions';
    expect(dto).toMatchObject({
      id: 'ev_sanctions_1',
      taskId: 'task789',
      fileName: 'sanctions_report.pdf',
      evidenceType: EvidenceType.SANCTIONS,
      fileSize: 4096,
      attachments: [],
      mimeType: 'application/pdf',
      hash: 'hash789',
      uploadedBy: 'user123',
      uploadedAt: new Date('2025-11-26T12:00:00Z'),
      archive: false,
      tags: 'tenant:tenant1,investigator:user123',
      description: 'Sanctions screening for case 001',
      comments: 'Screening completed and uploaded',
      couchdbRev: '1-sanctions',
    });
  });
  it('should allow summary disposition and tool/source metadata', () => {
    const dto = new EvidenceResponseDto();
    dto.description = 'Cleared';
    dto.tags = 'tool:WorldCheck,screeningDate:2025-11-26,reference:WC-REF-2025-001';
    expect(dto.description).toBe('Cleared');
    expect(dto.tags).toContain('tool:WorldCheck');
    expect(dto.tags).toContain('screeningDate:2025-11-26');
    expect(dto.tags).toContain('reference:WC-REF-2025-001');
  });
});

describe('VerifyEvidenceDto', () => {
  it('should create an instance with all required fields', () => {
    const dto = new VerifyEvidenceDto();
    dto.evidenceId = 'ev123';
    dto.expectedHash = 'hash123';
    dto.verified = true;
    dto.message = 'Verification successful';
    dto.verifiedAt = new Date('2025-11-26T12:00:00Z');
    dto.verifiedBy = 'user123';
    expect(dto.evidenceId).toBe('ev123');
    expect(dto.expectedHash).toBe('hash123');
    expect(dto.verified).toBe(true);
    expect(dto.message).toBe('Verification successful');
    expect(dto.verifiedAt).toEqual(new Date('2025-11-26T12:00:00Z'));
    expect(dto.verifiedBy).toBe('user123');
  });
});
