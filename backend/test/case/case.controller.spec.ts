import { Test, TestingModule } from '@nestjs/testing';
import { CaseController } from '../../src/case/case.controller';
import { CaseService } from '../../src/case/case.service';
import { CreateCaseDto } from '../../src/case/dto/create-case.dto';
import { UpdateCaseDto } from '../../src/case/dto/update-case.dto';
import { TazamaAuthGuard } from '../../src/auth/tazama-auth.guard';
import { CaseStatus, CaseType, Priority, CaseCreationType } from '@prisma/client';
import { AuthenticatedRequest } from '../../src/auth/auth.types';

describe('CaseController', () => {
  let controller: CaseController;

  const mockCaseService = {
    createCase: jest.fn(),
    retrieveCase: jest.fn(),
    updateCase: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseController],
      providers: [
        {
          provide: CaseService,
          useValue: mockCaseService,
        },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<CaseController>(CaseController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCase', () => {
    const createCaseDto: CreateCaseDto = {
      tenantId: 'tenant-123',
      caseCreatorUserId: 'creator-123',
      caseOwnerUserId: 'owner-123',
      status: CaseStatus.STATUS_00_DRAFT,
      priority: Priority.NEW,
      caseType: CaseType.FRAUD,
      caseCreationType: CaseCreationType.MANUAL,
    };

    const mockRequest = {
      user: {
        token: {
          clientId: 'user-123',
          iss: 'issuer',
          aud: 'audience',
          sub: 'subject',
          exp: 1234567890,
          iat: 1234567890,
          jti: 'token-id',
        },
        validated: { valid: true },
        validClaims: ['cms-test-role'],
      },
    } as unknown as AuthenticatedRequest;

    const mockCaseResponse = {
      case_id: 'case-123',
      tenant_id: 'tenant-123',
      case_creator_user_id: 'creator-123',
      case_owner_user_id: 'owner-123',
      status: CaseStatus.STATUS_00_DRAFT,
      priority: Priority.NEW,
      case_type: CaseType.FRAUD,
      case_creation_type: CaseCreationType.MANUAL,
      created_at: new Date(),
      updated_at: new Date(),
      parent_id: null,
    };

    it('should create a case successfully', async () => {
      mockCaseService.createCase.mockResolvedValue(mockCaseResponse);

      const result = await controller.createCase(createCaseDto, mockRequest);

      expect(mockCaseService.createCase).toHaveBeenCalledWith(createCaseDto, 'user-123');
      expect(result).toEqual(mockCaseResponse);
    });

    it('should handle service errors during case creation', async () => {
      const error = new Error('Service error');
      mockCaseService.createCase.mockRejectedValue(error);

      await expect(controller.createCase(createCaseDto, mockRequest)).rejects.toThrow('Service error');
      expect(mockCaseService.createCase).toHaveBeenCalledWith(createCaseDto, 'user-123');
    });

    it('should extract userId from request token', async () => {
      mockCaseService.createCase.mockResolvedValue(mockCaseResponse);

      await controller.createCase(createCaseDto, mockRequest);

      expect(mockCaseService.createCase).toHaveBeenCalledWith(createCaseDto, 'user-123');
    });
  });

  describe('getCase', () => {
    const caseId = 'case-123';
    const mockCaseResponse = {
      case_id: 'case-123',
      tenant_id: 'tenant-123',
      case_creator_user_id: 'creator-123',
      case_owner_user_id: 'owner-123',
      status: CaseStatus.STATUS_00_DRAFT,
      priority: Priority.NEW,
      case_type: CaseType.FRAUD,
      case_creation_type: CaseCreationType.MANUAL,
      created_at: new Date(),
      updated_at: new Date(),
      parent_id: null,
    };

    it('should retrieve a case successfully', async () => {
      mockCaseService.retrieveCase.mockResolvedValue(mockCaseResponse);

      const result = await controller.getCase(caseId);

      expect(mockCaseService.retrieveCase).toHaveBeenCalledWith(caseId);
      expect(result).toEqual(mockCaseResponse);
    });

    it('should handle service errors during case retrieval', async () => {
      const error = new Error('Case not found');
      mockCaseService.retrieveCase.mockRejectedValue(error);

      await expect(controller.getCase(caseId)).rejects.toThrow('Case not found');
      expect(mockCaseService.retrieveCase).toHaveBeenCalledWith(caseId);
    });

    it('should pass caseId parameter correctly', async () => {
      const testCaseId = 'test-case-456';
      mockCaseService.retrieveCase.mockResolvedValue(mockCaseResponse);

      await controller.getCase(testCaseId);

      expect(mockCaseService.retrieveCase).toHaveBeenCalledWith(testCaseId);
    });
  });

  describe('updateCase', () => {
    const caseId = 'case-123';
    const updateCaseDto: UpdateCaseDto = {
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      priority: Priority.URGENT,
      caseType: CaseType.AML,
      caseOwnerUserId: 'new-owner-123',
    };

    const mockRequest = {
      user: {
        token: {
          clientId: 'user-456',
          iss: 'issuer',
          aud: 'audience',
          sub: 'subject',
          exp: 1234567890,
          iat: 1234567890,
          jti: 'token-id',
        },
        validated: { valid: true },
        validClaims: ['cms-test-role'],
      },
    } as unknown as AuthenticatedRequest;

    const mockUpdatedCaseResponse = {
      case_id: 'case-123',
      tenant_id: 'tenant-123',
      case_creator_user_id: 'creator-123',
      case_owner_user_id: 'new-owner-123',
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      priority: Priority.URGENT,
      case_type: CaseType.AML,
      case_creation_type: CaseCreationType.MANUAL,
      created_at: new Date(),
      updated_at: new Date(),
      parent_id: null,
    };

    it('should update a case successfully', async () => {
      mockCaseService.updateCase.mockResolvedValue(mockUpdatedCaseResponse);

      const result = await controller.updateCase(caseId, updateCaseDto, mockRequest);

      expect(mockCaseService.updateCase).toHaveBeenCalledWith(caseId, updateCaseDto, 'user-456');
      expect(result).toEqual(mockUpdatedCaseResponse);
    });

    it('should handle service errors during case update', async () => {
      const error = new Error('Update failed');
      mockCaseService.updateCase.mockRejectedValue(error);

      await expect(controller.updateCase(caseId, updateCaseDto, mockRequest)).rejects.toThrow('Update failed');
      expect(mockCaseService.updateCase).toHaveBeenCalledWith(caseId, updateCaseDto, 'user-456');
    });

    it('should extract userId from request token for update', async () => {
      mockCaseService.updateCase.mockResolvedValue(mockUpdatedCaseResponse);

      await controller.updateCase(caseId, updateCaseDto, mockRequest);

      expect(mockCaseService.updateCase).toHaveBeenCalledWith(caseId, updateCaseDto, 'user-456');
    });

    it('should pass all parameters correctly', async () => {
      const testCaseId = 'test-case-789';
      const testUpdateDto: UpdateCaseDto = {
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        priority: Priority.CRITICAL,
        caseOwnerUserId: 'test-owner-789',
      };
      mockCaseService.updateCase.mockResolvedValue(mockUpdatedCaseResponse);

      await controller.updateCase(testCaseId, testUpdateDto, mockRequest);

      expect(mockCaseService.updateCase).toHaveBeenCalledWith(testCaseId, testUpdateDto, 'user-456');
    });

    it('should handle minimal update data', async () => {
      const minimalUpdateDto: UpdateCaseDto = {
        status: CaseStatus.STATUS_21_SUSPENDED,
        caseOwnerUserId: 'owner-123',
        priority: Priority.NEW,
      };
      mockCaseService.updateCase.mockResolvedValue(mockUpdatedCaseResponse);

      await controller.updateCase(caseId, minimalUpdateDto, mockRequest);

      expect(mockCaseService.updateCase).toHaveBeenCalledWith(caseId, minimalUpdateDto, 'user-456');
    });
  });
});
