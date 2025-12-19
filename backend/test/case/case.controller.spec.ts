import { Test, TestingModule } from '@nestjs/testing';
import { CaseController } from '../../src/modules/case/case.controller';
import { CaseService } from '../../src/modules/case/case.service';
import { CreateCaseDto } from '../../src/modules/case/dto/create-case.dto';
import { UpdateCaseDto } from '../../src/modules/case/dto/update-case.dto';
import { CaseStatus, CaseType, Priority, CaseCreationType } from '@prisma/client-cms';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { SystemCaseCreationDto } from 'src/modules/case/dto';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';

describe('CaseController', () => {
  let controller: CaseController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let caseService: jest.Mocked<CaseService>;

  const mockCaseService = {
    createCase: jest.fn(),
    retrieveCase: jest.fn(),
    updateCase: jest.fn(),
    createCaseSystemTransmission: jest.fn(),
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
    caseService = module.get(CaseService);
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

  describe('createCaseSystemTransmission', () => {
    it('should create case via system transmission successfully', async () => {
      const dto: SystemCaseCreationDto = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        priority: Priority.URGENT,
        alertData: {
          typology: 'Money Laundering',
          riskScore: 85,
          indicators: { suspicious: true },
        },
        transaction: {
          transactionId: 'txn-123',
          amount: 50000,
          currency: 'USD',
          debtor: { account: '123' },
          creditor: { account: '456' },
          timestamp: '2024-01-01',
        },
      };

      const mockRequest = {
        user: {
          token: {
            clientId: 'system-client-123',
          },
        },
      } as unknown as AuthenticatedRequest;

      const expectedResult = {
        caseId: 'case-123',
        status: 'AUTOCLOSED_CONFIRMED_71',
        processInstanceId: 'process-123',
      };

      mockCaseService.createCaseSystemTransmission.mockResolvedValue(expectedResult);

      const result = await controller.createCaseSystemTransmission(dto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockCaseService.createCaseSystemTransmission).toHaveBeenCalledWith(dto, 'system-client-123');
    });

    it('should handle errors in system transmission', async () => {
      const dto: SystemCaseCreationDto = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        alertData: {
          typology: 'Fraud',
          riskScore: 50,
          indicators: {},
        },
        transaction: {
          transactionId: 'txn-456',
          amount: 1000,
          currency: 'EUR',
          debtor: {},
          creditor: {},
          timestamp: '2024-01-01',
        },
      };

      const mockRequest = {
        user: {
          token: {
            clientId: 'client-456',
          },
        },
      } as unknown as AuthenticatedRequest;

      const error = new Error('Database error');
      mockCaseService.createCaseSystemTransmission.mockRejectedValue(error);

      await expect(controller.createCaseSystemTransmission(dto, mockRequest)).rejects.toThrow('Database error');
      expect(mockCaseService.createCaseSystemTransmission).toHaveBeenCalledWith(dto, 'client-456');
    });

    it('should extract clientId correctly from request token', async () => {
      const dto: SystemCaseCreationDto = {
        tenantId: 'tenant-123',
        alertData: {
          typology: 'Test',
          riskScore: 60,
          indicators: {},
        },
        transaction: {
          transactionId: 'txn-789',
          amount: 2000,
          currency: 'GBP',
          debtor: {},
          creditor: {},
          timestamp: '2024-01-01',
        },
      };

      const mockRequest = {
        user: {
          token: {
            clientId: 'extracted-client-id',
          },
        },
      } as unknown as AuthenticatedRequest;

      const expectedResult = {
        caseId: 'case-789',
        status: 'READY_FOR_ASSIGNMENT_02',
        processInstanceId: 'process-789',
      };

      mockCaseService.createCaseSystemTransmission.mockResolvedValue(expectedResult);

      await controller.createCaseSystemTransmission(dto, mockRequest);

      expect(mockCaseService.createCaseSystemTransmission).toHaveBeenCalledWith(dto, 'extracted-client-id');
    });
  });

  describe('debugToken', () => {
    it('should return token debug information', async () => {
      const mockRequest = {
        user: {
          token: {
            clientId: 'debug-client-123',
            tenantId: 'tenant-456',
            claims: ['claim1', 'claim2'],
            iss: 'issuer',
            aud: 'audience',
            sub: 'subject',
            exp: 1234567890,
            iat: 1234567800,
          },
        },
      } as unknown as AuthenticatedRequest;

      const result = await controller.debugToken(mockRequest);

      expect(result).toEqual({
        clientId: 'debug-client-123',
        tenantId: 'tenant-456',
        claims: ['claim1', 'claim2'],
        fullToken: mockRequest.user.token,
      });
    });

    it('should handle missing claims gracefully', async () => {
      const mockRequest = {
        user: {
          token: {
            clientId: 'debug-client-456',
            tenantId: 'tenant-789',
            // claims is undefined
          },
        },
      } as unknown as AuthenticatedRequest;

      const result = await controller.debugToken(mockRequest);

      expect(result).toEqual({
        clientId: 'debug-client-456',
        tenantId: 'tenant-789',
        claims: 'No claims found',
        fullToken: mockRequest.user.token,
      });
    });

    it('should handle complete token structure', async () => {
      const mockRequest = {
        user: {
          token: {
            clientId: 'complete-client-123',
            tenantId: 'complete-tenant-456',
            claims: ['admin', 'user', 'read'],
            iss: 'https://auth.example.com',
            aud: 'case-management-system',
            sub: 'user@example.com',
            exp: 1234567890,
            iat: 1234567800,
            jti: 'unique-token-id',
          },
        },
      } as unknown as AuthenticatedRequest;

      const result = await controller.debugToken(mockRequest);

      expect(result).toEqual({
        clientId: 'complete-client-123',
        tenantId: 'complete-tenant-456',
        claims: ['admin', 'user', 'read'],
        fullToken: {
          clientId: 'complete-client-123',
          tenantId: 'complete-tenant-456',
          claims: ['admin', 'user', 'read'],
          iss: 'https://auth.example.com',
          aud: 'case-management-system',
          sub: 'user@example.com',
          exp: 1234567890,
          iat: 1234567800,
          jti: 'unique-token-id',
        },
      });
    });
  });
});
