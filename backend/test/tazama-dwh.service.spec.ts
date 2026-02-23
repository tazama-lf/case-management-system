import { Test, TestingModule } from '@nestjs/testing';
import { TazamaDwhService } from '../src/modules/tazama-dwh/tazama-dwh.service';
import { PrismaDWHService } from '../prismaDWH/prismaDWH.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { GenerateProfileDto } from '../src/modules/tazama-dwh/dto/generate-profile.dto';

describe('TazamaDwhService', () => {
  let service: TazamaDwhService;
  let prismaDwh: jest.Mocked<PrismaDWHService>;
  let logger: jest.Mocked<LoggerService>;
  let auditLog: jest.Mocked<AuditLogService>;

  const mockTransaction = {
    cre_dt_tm: '2026-01-15',
    end_to_end_id: 'tx-123',
    tx_tp: 'pacs.002.001.12',
    source: 'acc-source',
    destination: 'acc-destination',
    role: 'Debtor',
    amt: { toNumber: () => 1000 },
    geography: 'Domestic',
    tenant_id: 'tenant-123',
    ccy: 'USD',
  };

  const mockCustomer = {
    id: 'customer-123',
    tenant_id: 'tenant-123',
    name: 'John Doe',
    date_of_birth: '1990-01-01',
    email: 'john@example.com',
    phone: '+1234567890',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
    },
    accounts: [
      {
        id: 'acc-123',
        account_type: 'SAVINGS',
        opened_date: '2020-01-01',
        balance: { toNumber: () => 5000 },
        risk_rating: 'LOW',
        customer_id: 'customer-123',
        tenant_id: 'tenant-123',
      },
    ],
  };

  const mockAccount = {
    id: 'acc-123',
    account_type: 'SAVINGS',
    opened_date: '2020-01-01',
    balance: { toNumber: () => 5000 },
    risk_rating: 'LOW',
    customer_id: 'customer-123',
    tenant_id: 'tenant-123',
    customer: mockCustomer,
  };

  beforeEach(async () => {
    const mockTransactionMethods = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };

    const mockCustomerMethods = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    };

    const mockAccountMethods = {
      findFirst: jest.fn(),
    };

    const mockPrismaDwh = {
      transaction: mockTransactionMethods,
      customer: mockCustomerMethods,
      account: mockAccountMethods,
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockAuditLog = {
      logAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TazamaDwhService,
        { provide: PrismaDWHService, useValue: mockPrismaDwh },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<TazamaDwhService>(TazamaDwhService);
    prismaDwh = module.get(PrismaDWHService) as any;
    logger = module.get(LoggerService);
    auditLog = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateProfile', () => {
    const generateProfileDto: GenerateProfileDto = {
      tenantId: 'tenant-123',
      filters: {
        creditorId: 'acc-destination',
        debtorId: 'acc-source',
        type: 'pacs.002.001.12',
        account: 'acc-123',
        role: 'Debtor',
      },
      notes: 'Test profile generation',
    };

    it('should generate profile successfully', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);
      (auditLog.logAction as jest.Mock).mockResolvedValue({} as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result).toHaveProperty('tenantId', generateProfileDto.tenantId);
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('outliers');
      expect(result).toHaveProperty('summaryTable');
      expect(result).toHaveProperty('detectedAnomalies');
      expect(result).toHaveProperty('transactionTable');
      expect(result.metrics.totalVolume).toBe(1);
      expect(auditLog.logAction).toHaveBeenCalledWith({
        userId: 'user-123',
        operation: 'generate',
        entityName: 'TransactionProfile',
        actionPerformed: 'PROFILE_GENERATED',
        outcome: 'SUCCESS',
      });
    });

    it('should generate profile with different filter combinations', async () => {
      const minimalDto: GenerateProfileDto = {
        tenantId: 'tenant-123',
        filters: {},
      };

      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);
      (auditLog.logAction as jest.Mock).mockResolvedValue({} as any);

      const result = await service.generateProfile(minimalDto, 'user-123');

      expect(result).toHaveProperty('tenantId', minimalDto.tenantId);
      expect(prismaDwh.transaction.findMany).toHaveBeenCalled();
    });

    it('should handle empty transaction results', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any);
      (auditLog.logAction as jest.Mock).mockResolvedValue({} as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.totalVolume).toBe(0);
      expect(result.metrics.totalValue).toBe(0);
      expect(result.metrics.avgTicketSize).toBe(0);
    });

    it('should detect anomalies correctly', async () => {
      const normalTx = {
        ...mockTransaction,
        amt: { toNumber: () => 1000 },
      };
      const highValueTx = {
        ...mockTransaction,
        amt: { toNumber: () => 10000 },
      };
      
      // Mock peer transactions with normal values to establish baseline
      const peerTransactions = [
        { ...mockTransaction, amt: { toNumber: () => 1000 } },
        { ...mockTransaction, amt: { toNumber: () => 1200 } },
        { ...mockTransaction, amt: { toNumber: () => 900 } },
      ];
      
      // First call for actual transactions, second call for peer baseline
      (prismaDwh.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce([highValueTx] as any)
        .mockResolvedValueOnce(peerTransactions as any);
      (auditLog.logAction as jest.Mock).mockResolvedValue({} as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.detectedAnomalies).toBeDefined();
      expect(result.detectedAnomalies!.length).toBeGreaterThan(0);
      expect(result.detectedAnomalies![0].risk).toBe('High');
    });

    it('should handle cross-border transactions', async () => {
      const crossBorderTx = {
        ...mockTransaction,
        geography: 'Cross-border',
        amt: { toNumber: () => 3000 },
      };
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([crossBorderTx] as any);
      (auditLog.logAction as jest.Mock).mockResolvedValue({} as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.crossBorderCount).toBe(1);
    });
  });

  describe('getTransactionsByDebtorId', () => {
    it('should fetch transactions by debtor ID successfully', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result = await service.getTransactionsByDebtorId('tenant-123', 'acc-source');

      expect(result).toEqual([mockTransaction]);
      expect(prismaDwh.transaction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: 'tenant-123',
          source: 'acc-source',
        }),
        orderBy: { cre_dt_tm: 'desc' },
      });
    });

    it('should throw NotFoundException when no transactions found', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any);

      await expect(
        service.getTransactionsByDebtorId('tenant-123', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.getTransactionsByDebtorId('tenant-123', 'acc-source'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(notFoundError);

      await expect(
        service.getTransactionsByDebtorId('tenant-123', 'acc-source'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactionsByCreditorId', () => {
    it('should fetch transactions by creditor ID successfully', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result = await service.getTransactionsByCreditorId('tenant-123', 'acc-destination');

      expect(result).toEqual([mockTransaction]);
      expect(prismaDwh.transaction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: 'tenant-123',
          destination: 'acc-destination',
        }),
        orderBy: { cre_dt_tm: 'desc' },
      });
    });

    it('should throw NotFoundException when no transactions found', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any);

      await expect(
        service.getTransactionsByCreditorId('tenant-123', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.getTransactionsByCreditorId('tenant-123', 'acc-destination'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(notFoundError);

      await expect(
        service.getTransactionsByCreditorId('tenant-123', 'acc-destination'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomerProfileByTransaction', () => {
    it('should fetch customer profile by transaction successfully', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      const mockAccountFind = prismaDwh.account.findFirst as jest.Mock;
      mockAccountFind
        .mockResolvedValueOnce(mockAccount as any)
        .mockResolvedValueOnce(mockAccount as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      expect(result).toHaveProperty('customerDetails');
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('accountDetails');
      expect(result.accountDetails).toHaveProperty('sender');
      expect(result.accountDetails).toHaveProperty('receiver');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerProfileByTransaction('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when account not found', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle customer without address', async () => {
      const accountWithoutAddress = {
        ...mockAccount,
        customer: {
          ...mockCustomer,
          address: null,
        },
      };
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      const mockAccountFind = prismaDwh.account.findFirst as jest.Mock;
      mockAccountFind
        .mockResolvedValueOnce(accountWithoutAddress as any)
        .mockResolvedValueOnce(accountWithoutAddress as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      expect(result.address).toEqual([]);
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCustomerProfileById', () => {
    it('should fetch customer profile by ID successfully', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result).toHaveProperty('customerId', 'customer-123');
      expect(result).toHaveProperty('name', 'John Doe');
      expect(result).toHaveProperty('accounts');
      expect(result.accounts.length).toBe(1);
    });

    it('should determine account roles correctly (Debtor)', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      const debtorTransactions = [
        { ...mockTransaction, source: 'acc-123', destination: 'other-acc' },
        { ...mockTransaction, source: 'acc-123', destination: 'other-acc2' },
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue(debtorTransactions as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.accounts[0].role).toBe('Debtor (Sender/Payer)');
    });

    it('should determine account roles correctly (Creditor)', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      const creditorTransactions = [
        { ...mockTransaction, source: 'other-acc', destination: 'acc-123' },
        { ...mockTransaction, source: 'other-acc2', destination: 'acc-123' },
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue(creditorTransactions as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.accounts[0].role).toBe('Creditor (Receiver/Payee)');
    });

    it('should determine account roles correctly (Both)', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      const mixedTransactions = [
        { ...mockTransaction, source: 'acc-123', destination: 'other-acc' },
        { ...mockTransaction, source: 'other-acc', destination: 'acc-123' },
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue(mixedTransactions as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.accounts[0].role).toBe('Both (Sender & Receiver)');
    });

    it('should handle account with no transactions', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.accounts[0].role).toBeUndefined();
    });

    it('should fall back to getCustomerByAccountId when customer not found', async () => {
      const mockCustomerFind = prismaDwh.customer.findFirst as jest.Mock;
      mockCustomerFind
        .mockResolvedValueOnce(null);
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(mockAccount as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerProfileById('acc-123');

      expect(result).toHaveProperty('customerId');
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerProfileById('customer-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.customer.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfileById('customer-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCustomerProfile', () => {
    it('should fetch customer profile with tenantId successfully', async () => {
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result = await service.getCustomerProfile('customer-123', 'tenant-123');

      expect(result).toHaveProperty('customerId', 'customer-123');
      expect(prismaDwh.customer.findUnique).toHaveBeenCalledWith({
        where: {
          id_tenant_id: {
            id: 'customer-123',
            tenant_id: 'tenant-123',
          },
        },
        include: {
          accounts: true,
        },
      });
    });

    it('should fetch customer profile without tenantId successfully', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result = await service.getCustomerProfile('customer-123');

      expect(result).toHaveProperty('customerId', 'customer-123');
      expect(prismaDwh.customer.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'customer-123',
        },
        include: {
          accounts: true,
        },
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerProfile('non-existent', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle customer without address', async () => {
      const customerWithoutAddress = {
        ...mockCustomer,
        address: null,
      };
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(customerWithoutAddress as any);

      const result = await service.getCustomerProfile('customer-123', 'tenant-123');

      expect(result.address).toBeUndefined();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.customer.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerProfile('customer-123', 'tenant-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.customer.findUnique as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfile('customer-123', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCustomerByAccountId', () => {
    it('should fetch customer by account ID successfully', async () => {
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(mockAccount as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([
        { ...mockTransaction, source: 'acc-123', destination: 'other-acc' },
      ] as any);
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerByAccountId('acc-123');

      expect(result).toHaveProperty('customerId');
      expect(result).toHaveProperty('accounts');
    });

    it('should throw NotFoundException when account not found', async () => {
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerByAccountId('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle account without customer', async () => {
      const accountWithoutCustomer = {
        ...mockAccount,
        customer: null,
        customer_id: null,
      };
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(accountWithoutCustomer as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result: any = await service.getCustomerByAccountId('acc-123');

      expect(result).toHaveProperty('customerId');
      expect(result.accounts.length).toBe(1);
    });

    it('should determine role as Both for equal transactions', async () => {
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(mockAccount as any);
      const transactions = [
        { ...mockTransaction, source: 'acc-123', destination: 'other-acc' },
        { ...mockTransaction, source: 'other-acc', destination: 'acc-123' },
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue(transactions as any);
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerByAccountId('acc-123');

      expect(result.accounts[0].role).toBe('Both (Sender & Receiver)');
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.account.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerByAccountId('acc-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.account.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerByAccountId('acc-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});


