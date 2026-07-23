import { describe, it, expect } from 'vitest';
import type {
  EvidenceAttachment,
  Evidence,
  EvidenceType,
  EvidenceMetadata,
  UploadEvidenceDto,
  UploadEvidenceResponse,
  VerifyEvidenceDto,
  VerifyEvidenceResponse,
  EvidenceSearchFilters,
  EvidenceListResponse,
  DeleteEvidenceResponse,
  DownloadEvidenceResponse,
  EvidenceAuditLog,
  EvidenceStatistics,
} from '../evidence.types';

describe('evidence.types', () => {
  describe('EvidenceAttachment', () => {
    it('can be instantiated with required fields', () => {
      const attachment: EvidenceAttachment = {
        fileName: 'test.pdf',
        fileSize: 1024,
        filePath: '/path/to/file',
        mimeType: 'application/pdf',
        hash: 'abc123',
      };

      expect(attachment.fileName).toBe('test.pdf');
      expect(attachment.fileSize).toBe(1024);
    });

    it('can include optional encryption fields', () => {
      const attachment: EvidenceAttachment = {
        fileName: 'test.pdf',
        fileSize: 1024,
        filePath: '/path/to/file',
        mimeType: 'application/pdf',
        hash: 'abc123',
        encryption: {
          key: 'key123',
          iv: 'iv123',
          authTag: 'tag123',
        },
      };

      expect(attachment.encryption).toBeDefined();
    });
  });

  describe('Evidence', () => {
    it('can be instantiated with required fields', () => {
      const evidence: Evidence = {
        id: 'EVIDENCE-1',
        taskId: 'TASK-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        hash: 'abc123',
        filePath: '/path/to/file',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        evidenceType: 'SANCTIONS',
      };

      expect(evidence.id).toBe('EVIDENCE-1');
      expect(evidence.evidenceType).toBe('SANCTIONS');
    });

    it('can include optional fields', () => {
      const evidence: Evidence = {
        id: 'EVIDENCE-1',
        taskId: 'TASK-1',
        caseId: 'CASE-123',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        hash: 'abc123',
        filePath: '/path/to/file',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        evidenceType: 'SANCTIONS',
        description: 'Test evidence',
        verified: true,
        tags: 'tag1,tag2',
      };

      expect(evidence.caseId).toBe('CASE-123');
      expect(evidence.verified).toBe(true);
    });
  });

  describe('EvidenceType', () => {
    it('accepts valid evidence types', () => {
      const types: EvidenceType[] = [
        'SANCTIONS',
        'ADVERSE_MEDIA',
        'OTHER',
        'SAR_STR_FILING',
        'KYC',
        'EDD',
      ];

      types.forEach((type) => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('UploadEvidenceDto', () => {
    it('can be instantiated with required fields', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const dto: UploadEvidenceDto = {
        file,
        taskId: 'TASK-1',
        evidenceType: 'SANCTIONS',
      };

      expect(dto.file).toBe(file);
      expect(dto.evidenceType).toBe('SANCTIONS');
    });
  });

  describe('UploadEvidenceResponse', () => {
    it('can be instantiated', () => {
      const response: UploadEvidenceResponse = {
        id: 'EVIDENCE-1',
        taskId: 'TASK-1',
        fileName: 'test.pdf',
        evidenceType: 'SANCTIONS',
        fileSize: 1024,
        mimeType: 'application/pdf',
        hash: 'abc123',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        filePath: '/path/to/file',
      };

      expect(response.id).toBe('EVIDENCE-1');
    });
  });

  describe('VerifyEvidenceDto', () => {
    it('can be instantiated', () => {
      const dto: VerifyEvidenceDto = {
        evidenceId: 'EVIDENCE-1',
        expectedHash: 'abc123',
      };

      expect(dto.evidenceId).toBe('EVIDENCE-1');
    });
  });

  describe('VerifyEvidenceResponse', () => {
    it('can be instantiated', () => {
      const response: VerifyEvidenceResponse = {
        evidenceId: 'EVIDENCE-1',
        expectedHash: 'abc123',
        verified: true,
        message: 'Verified',
        verifiedAt: new Date(),
        verifiedBy: 'user-1',
      };

      expect(response.verified).toBe(true);
    });
  });

  describe('EvidenceSearchFilters', () => {
    it('can be instantiated with optional filters', () => {
      const filters: EvidenceSearchFilters = {
        evidenceType: 'SANCTIONS',
        verified: true,
        search: 'test',
      };

      expect(filters.evidenceType).toBe('SANCTIONS');
    });
  });

  describe('EvidenceListResponse', () => {
    it('can be instantiated', () => {
      const response: EvidenceListResponse = {
        evidence: [],
        total: 0,
      };

      expect(response.total).toBe(0);
    });
  });

  describe('DeleteEvidenceResponse', () => {
    it('can be instantiated', () => {
      const response: DeleteEvidenceResponse = {
        success: true,
        message: 'Deleted',
        evidenceId: 'EVIDENCE-1',
      };

      expect(response.success).toBe(true);
    });
  });

  describe('EvidenceAuditLog', () => {
    it('can be instantiated', () => {
      const log: EvidenceAuditLog = {
        logId: 'LOG-1',
        evidenceId: 'EVIDENCE-1',
        action: 'UPLOAD',
        userId: 'user-1',
        timestamp: new Date(),
      };

      expect(log.action).toBe('UPLOAD');
    });
  });

  describe('EvidenceStatistics', () => {
    it('can be instantiated', () => {
      const stats: EvidenceStatistics = {
        totalCount: 10,
        totalSize: 1024,
        byType: {
          SANCTIONS: 5,
          KYC: 3,
          EDD: 2,
          ADVERSE_MEDIA: 0,
          OTHER: 0,
          SAR_STR_FILING: 0,
        },
        verifiedCount: 8,
        unverifiedCount: 2,
      };

      expect(stats.totalCount).toBe(10);
    });
  });
});
