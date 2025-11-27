import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceController } from '../../src/evidence/evidence.controller';
import { EvidenceService } from '../../src/evidence/evidence.service';
import { UploadEvidenceDto, EvidenceType } from '../../src/evidence/dto/upload-evidence.dto';
import { EvidenceResponseDto } from '../../src/evidence/dto/evidence-response.dto';

describe('EvidenceController', () => {
  let controller: EvidenceController;
  let service: EvidenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: {
            uploadEvidence: jest.fn(),
            getEvidenceById: jest.fn(),
            getEvidenceByTaskId: jest.fn(),
            getEvidenceByType: jest.fn(),
            getEvidenceByCaseId: jest.fn(),
            downloadEvidence: jest.fn(),
            verifyEvidence: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
    service = module.get<EvidenceService>(EvidenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call uploadEvidence and return response', async () => {
    const files = [{ originalname: 'file1.pdf', buffer: Buffer.from('test'), mimetype: 'application/pdf', size: 1234 }];
    const dto: UploadEvidenceDto = {
      taskId: 'task123',
      evidenceType: EvidenceType.KYC,
      tags: 'tag1',
      description: 'desc',
      comments: 'comment',
    };
    const expected: EvidenceResponseDto = {
      id: 'ev_task123_1',
                  taskId: 'task123',
                  fileName: 'file1.pdf',
                  evidenceType: EvidenceType.KYC,
                  fileSize: 1234,
                  attachments: [],
                  mimeType: 'application/pdf',
                  hash: 'hash',
                  uploadedBy: 'user1',
                  uploadedAt: new Date(),
                  archive: false,
                  tags: 'tag1',
                  description: 'desc',
                  comments: 'comment',
                  couchdbRev: '1-abc',
                };
                (service.uploadEvidence as jest.Mock).mockResolvedValue(expected);
                const mockReq = {
                  user: {
                    token: {
                      clientId: 'user1',
                      tenantId: 'tenant1',
                      claims: ['CMS_SUPERVISOR'],
                    },
                  },
                };
                const result = await controller.uploadEvidence(files, dto, mockReq as any);
                expect(service.uploadEvidence).toHaveBeenCalledWith(files, dto, 'user1', 'tenant1');
    expect(result).toEqual(expected);
  });

              it('should call getEvidenceByTask and return response', async () => {
                const expected = { evidence: [], total: 0, taskId: 'task123' };
                (service.getEvidenceByTaskId as jest.Mock).mockResolvedValue(expected);
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                const result = await controller.getEvidenceByTask('task123', mockReq as any);
                expect(service.getEvidenceByTaskId).toHaveBeenCalledWith('task123', 'user1', 'tenant1', 'CMS_SUPERVISOR');
                expect(result).toEqual(expected);
              });

              it('should call getEvidenceByType and return response', async () => {
                const expected = { evidence: [], total: 0, evidenceType: EvidenceType.KYC };
                (service.getEvidenceByType as jest.Mock).mockResolvedValue(expected);
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                const result = await controller.getEvidenceByType(EvidenceType.KYC, mockReq as any);
                expect(service.getEvidenceByType).toHaveBeenCalledWith(EvidenceType.KYC, 'user1', 'tenant1', 'CMS_SUPERVISOR');
                expect(result).toEqual(expected);
              });

              it('should call getEvidenceByCase and return response', async () => {
                const expected = { evidence: [], total: 0, taskId: undefined };
                (service.getEvidenceByCaseId as jest.Mock).mockResolvedValue(expected);
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                const result = await controller.getEvidenceByCase('case123', mockReq as any);
                expect(service.getEvidenceByCaseId).toHaveBeenCalledWith('case123', 'user1', 'tenant1', 'CMS_SUPERVISOR');
                expect(result).toEqual(expected);
              });

              it('should call getEvidenceById and return response', async () => {
                const expected = { id: 'ev1', taskId: 'task123', fileName: 'file1.pdf', evidenceType: EvidenceType.KYC };
                (service.getEvidenceById as jest.Mock).mockResolvedValue(expected);
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                const result = await controller.getEvidenceById('ev1', mockReq as any);
                expect(service.getEvidenceById).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR');
                expect(result).toEqual(expected);
              });

              it('should call downloadEvidence and set response headers', async () => {
                const mockRes = { set: jest.fn(), send: jest.fn() };
                const mockFile = { file: Buffer.from('test'), attachmentMeta: { fileName: 'file1.pdf', mimeType: 'application/pdf' } };
                (service.downloadEvidence as jest.Mock).mockResolvedValue({ files: [mockFile], metadata: {} });
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                await controller.downloadEvidence('ev1', mockRes as any, 'file1.pdf', mockReq as any);
                expect(service.downloadEvidence).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR', 'file1.pdf');
                expect(mockRes.set).toHaveBeenCalledWith({
                  'Content-Type': 'application/pdf',
                  'Content-Disposition': 'attachment; filename="file1.pdf"',
                  'Content-Length': Buffer.from('test').length,
                });
                expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('test'));
              });

              it('should call verifyEvidence and return response', async () => {
                const expected = { evidenceId: 'ev1', verified: true, message: 'OK', verifiedAt: new Date() };
                (service.verifyEvidence as jest.Mock).mockResolvedValue(expected);
                const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
                const result = await controller.verifyEvidence('ev1', 'file1.pdf', mockReq as any);
                expect(service.verifyEvidence).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR', 'file1.pdf');
                expect(result).toEqual(expected);
              });
  it('should call getEvidenceByTask and return response', async () => {
    const expected = { evidence: [], total: 0, taskId: 'task123' };
    (service.getEvidenceByTaskId as jest.Mock).mockResolvedValue(expected);
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    const result = await controller.getEvidenceByTask('task123', mockReq as any);
    expect(service.getEvidenceByTaskId).toHaveBeenCalledWith('task123', 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result).toEqual(expected);
  });

  it('should call getEvidenceByType and return response', async () => {
    const expected = { evidence: [], total: 0, evidenceType: EvidenceType.KYC };
    (service.getEvidenceByType as jest.Mock).mockResolvedValue(expected);
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    const result = await controller.getEvidenceByType(EvidenceType.KYC, mockReq as any);
    expect(service.getEvidenceByType).toHaveBeenCalledWith(EvidenceType.KYC, 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result).toEqual(expected);
  });

  it('should call getEvidenceByCase and return response', async () => {
    const expected = { evidence: [], total: 0, taskId: undefined };
    (service.getEvidenceByCaseId as jest.Mock).mockResolvedValue(expected);
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    const result = await controller.getEvidenceByCase('case123', mockReq as any);
    expect(service.getEvidenceByCaseId).toHaveBeenCalledWith('case123', 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result).toEqual(expected);
  });

  it('should call getEvidenceById and return response', async () => {
    const expected = { id: 'ev1', taskId: 'task123', fileName: 'file1.pdf', evidenceType: EvidenceType.KYC };
    (service.getEvidenceById as jest.Mock).mockResolvedValue(expected);
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    const result = await controller.getEvidenceById('ev1', mockReq as any);
    expect(service.getEvidenceById).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result).toEqual(expected);
  });

  it('should call downloadEvidence and set response headers', async () => {
    const mockRes = { set: jest.fn(), send: jest.fn() };
    const mockFile = { file: Buffer.from('test'), attachmentMeta: { fileName: 'file1.pdf', mimeType: 'application/pdf' } };
    (service.downloadEvidence as jest.Mock).mockResolvedValue({ files: [mockFile], metadata: {} });
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    await controller.downloadEvidence('ev1', mockRes as any, 'file1.pdf', mockReq as any);
    expect(service.downloadEvidence).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR', 'file1.pdf');
    expect(mockRes.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="file1.pdf"',
      'Content-Length': Buffer.from('test').length,
    });
    expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('test'));
  });

  it('should call verifyEvidence and return response', async () => {
    const expected = { evidenceId: 'ev1', verified: true, message: 'OK', verifiedAt: new Date() };
    (service.verifyEvidence as jest.Mock).mockResolvedValue(expected);
    const mockReq = { user: { token: { clientId: 'user1', tenantId: 'tenant1', claims: ['CMS_SUPERVISOR'] } } };
    const result = await controller.verifyEvidence('ev1', 'file1.pdf', mockReq as any);
    expect(service.verifyEvidence).toHaveBeenCalledWith('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR', 'file1.pdf');
    expect(result).toEqual(expected);
  });
});
