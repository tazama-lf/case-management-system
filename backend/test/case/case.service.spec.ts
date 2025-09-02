import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from '../../src/case/case.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';

describe('CaseService', () => {
  let service: CaseService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockCase = {
    case_id: 'test-case-1',
    case_title: 'Test Case',
    case_description: 'Test case description',
    case_status: 'DRAFT_00',
    created_at: new Date(),
    updated_at: new Date(),
    case_priority: 'MEDIUM',
    case_assignee: null,
    case_created_by: 'test-user',
  };

  beforeEach(async () => {
    mockPrismaService = {
      case: {
        findMany: jest.fn().mockResolvedValue([mockCase]),
        findUnique: jest.fn().mockResolvedValue(mockCase),
        create: jest.fn().mockResolvedValue(mockCase),
        update: jest.fn().mockResolvedValue(mockCase),
        delete: jest.fn().mockResolvedValue(mockCase),
      },
    } as any;

    mockAuditLogService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all cases', async () => {
      const result = await service.findAll();

      expect(result).toEqual([mockCase]);
      expect(mockPrismaService.case.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPrismaService.case.findMany.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a case by id', async () => {
      const result = await service.findOne('test-case-1');

      expect(result).toEqual(mockCase);
      expect(mockPrismaService.case.findUnique).toHaveBeenCalledWith({
        where: { case_id: 'test-case-1' },
      });
    });

    it('should return null for non-existent case', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new case', async () => {
      const createCaseDto = {
        case_title: 'New Case',
        case_description: 'New case description',
        case_status: 'DRAFT_00' as any,
      };

      const result = await service.create(createCaseDto, 'test-user');

      expect(result).toEqual(mockCase);
      expect(mockPrismaService.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          case_title: createCaseDto.case_title,
          case_description: createCaseDto.case_description,
          case_status: createCaseDto.case_status,
          case_created_by: 'test-user',
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a case', async () => {
      const updateCaseDto = {
        case_title: 'Updated Case',
        case_description: 'Updated description',
      };

      const result = await service.update('test-case-1', updateCaseDto, 'test-user');

      expect(result).toEqual(mockCase);
      expect(mockPrismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: 'test-case-1' },
        data: expect.objectContaining({
          case_title: updateCaseDto.case_title,
          case_description: updateCaseDto.case_description,
          case_last_updated_by: 'test-user',
        }),
      });
    });
  });

  describe('remove', () => {
    it('should delete a case', async () => {
      const result = await service.remove('test-case-1', 'test-user');

      expect(result).toEqual(mockCase);
      expect(mockPrismaService.case.delete).toHaveBeenCalledWith({
        where: { case_id: 'test-case-1' },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        'test-user',
        'DELETE_CASE',
        'Case',
        'test-case-1'
      );
    });
  });
});
