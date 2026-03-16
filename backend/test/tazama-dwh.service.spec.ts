import { Test, TestingModule } from '@nestjs/testing';
import { TazamaDwhService } from '../src/modules/tazama-dwh/tazama-dwh.service';
import { PrismaDWHService } from '../prismaDWH/prismaDWH.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { GenerateProfileDto } from '../src/modules/tazama-dwh/dto/generate-profile.dto';

describe('TazamaDwhService', () => {
  let service: TazamaDwhService;
  let prismaDwh: jest.Mocked<PrismaDWHService>;
  let logger: jest.Mocked<LoggerService>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TazamaDwhService,
        { provide: PrismaDWHService, useValue: mockPrismaDwh },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<TazamaDwhService>(TazamaDwhService);
    prismaDwh = module.get(PrismaDWHService) as any;
    logger = module.get(LoggerService);
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

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result).toHaveProperty('tenantId', generateProfileDto.tenantId);
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('outliers');
      expect(result).toHaveProperty('summaryTable');
      expect(result).toHaveProperty('detectedAnomalies');
      expect(result).toHaveProperty('transactionTable');
      expect(result.metrics.totalVolume).toBe(1);
    });

    it('should generate profile with different filter combinations', async () => {
      const minimalDto: GenerateProfileDto = {
        tenantId: 'tenant-123',
        filters: {},
      };

      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result = await service.generateProfile(minimalDto, 'user-123');

      expect(result).toHaveProperty('tenantId', minimalDto.tenantId);
      expect(prismaDwh.transaction.findMany).toHaveBeenCalled();
    });

    it('should handle empty transaction results', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any);

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

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.crossBorderCount).toBe(1);
    });

    it('should handle transactions with null amt and cre_dt_tm (hits ?? 0 and ?? "" branches)', async () => {
      const sparseTx = {
        ...mockTransaction,
        amt: null,
        cre_dt_tm: null,
      };
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([sparseTx] as any).mockResolvedValueOnce([sparseTx] as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.totalValue).toBe(0);
      expect(result.metrics.avgTicketSize).toBe(0);
    });

    it('should handle empty peer transactions (hits || 1 division guard)', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([mockTransaction] as any).mockResolvedValueOnce([] as any); // empty peers

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      // With no peer transactions, avg = 0, so any transaction > 0 is an outlier
      expect(result.detectedAnomalies!.length).toBeGreaterThan(0);
    });

    it('should assign Medium risk (2000 < amt <= 5000)', async () => {
      const mediumTx = { ...mockTransaction, amt: { toNumber: () => 3000 } };
      const peerTx = { ...mockTransaction, amt: { toNumber: () => 100 } };
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([mediumTx] as any).mockResolvedValueOnce([peerTx] as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.detectedAnomalies![0].risk).toBe('Medium');
    });

    it('should assign Low risk (amt <= 2000)', async () => {
      const lowTx = { ...mockTransaction, amt: { toNumber: () => 1500 } };
      const peerTx = { ...mockTransaction, amt: { toNumber: () => 100 } };
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([lowTx] as any).mockResolvedValueOnce([peerTx] as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.detectedAnomalies![0].risk).toBe('Low');
    });

    it('should use Cross-border anomaly description when geography triggers outlier', async () => {
      const cbTx = { ...mockTransaction, geography: 'Cross-border', amt: { toNumber: () => 500 } };
      const peerTxs = [
        { ...mockTransaction, amt: { toNumber: () => 2000 } }, // high peer avg
        { ...mockTransaction, geography: 'Cross-border', amt: { toNumber: () => 100 } }, // low cb peer
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([cbTx] as any).mockResolvedValueOnce(peerTxs as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      const anomaly = result.detectedAnomalies!.find((a) => a.description === 'Cross-border anomaly');
      expect(anomaly).toBeDefined();
    });

    it('should handle getGeography fallback chains (tx.transaction?.geography, tx.transaction?.TxTp)', async () => {
      const txWithNestedGeography = {
        ...mockTransaction,
        geography: undefined,
        transaction: { geography: 'Cross-border', TxTp: 'fallback' },
        amt: { toNumber: () => 1000 },
      };
      const txWithNestedTxTp = {
        ...mockTransaction,
        geography: undefined,
        transaction: { geography: undefined, TxTp: 'Cross-border' },
        amt: { toNumber: () => 1000 },
      };
      const peerTxs = [{ ...mockTransaction, amt: { toNumber: () => 100 } }];
      (prismaDwh.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce([txWithNestedGeography, txWithNestedTxTp] as any)
        .mockResolvedValueOnce(peerTxs as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.crossBorderCount).toBe(2);
    });

    it('should handle getGeography final fallback (tx.transaction?.TxTp ?? "")', async () => {
      const txWithFinalFallback = {
        ...mockTransaction,
        geography: undefined,
        transaction: { geography: undefined, TxTp: undefined },
        amt: { toNumber: () => 1000 },
      };
      const peerTxs = [{ ...mockTransaction, amt: { toNumber: () => 100 } }];
      (prismaDwh.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce([txWithFinalFallback] as any)
        .mockResolvedValueOnce(peerTxs as any);

      const result = await service.generateProfile(generateProfileDto, 'user-123');

      expect(result.metrics.crossBorderCount).toBe(0); // empty string doesn't match 'Cross-border'
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

      await expect(service.getTransactionsByDebtorId('tenant-123', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getTransactionsByDebtorId('tenant-123', 'acc-source')).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getTransactionsByDebtorId('tenant-123', 'acc-source')).rejects.toThrow(NotFoundException);
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

      await expect(service.getTransactionsByCreditorId('tenant-123', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getTransactionsByCreditorId('tenant-123', 'acc-destination')).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getTransactionsByCreditorId('tenant-123', 'acc-destination')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomerProfileByTransaction', () => {
    it('should fetch customer profile by transaction successfully', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      const mockAccountFind = prismaDwh.account.findFirst as jest.Mock;
      mockAccountFind.mockResolvedValueOnce(mockAccount as any).mockResolvedValueOnce(mockAccount as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      expect(result).toHaveProperty('customerDetails');
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('accountDetails');
      expect(result.accountDetails).toHaveProperty('sender');
      expect(result.accountDetails).toHaveProperty('receiver');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerProfileByTransaction('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when account not found', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.transaction.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(InternalServerErrorException);

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
      mockAccountFind.mockResolvedValueOnce(accountWithoutAddress as any).mockResolvedValueOnce(accountWithoutAddress as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      expect(result.address).toEqual([]);
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.transaction.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfileByTransaction('tx-123')).rejects.toThrow(NotFoundException);
    });

    it('should handle sparse account data (null balance, account_type, etc.)', async () => {
      const sparseAccount = {
        id: 'acc-sparse',
        account_type: null,
        opened_date: null,
        balance: null,
        risk_rating: null,
        customer_id: 'customer-123',
        tenant_id: 'tenant-123',
        customer: {
          id: 'customer-123',
          name: null,
          date_of_birth: null,
          email: null,
          phone: null,
          address: null,
        },
      };
      const sparseTx = {
        ...mockTransaction,
        amt: null,
        ccy: null,
      };

      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(sparseTx as any);
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValueOnce(sparseAccount as any).mockResolvedValueOnce(sparseAccount as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      // Test that undefined values are returned for null fields
      expect(result.accountDetails.sender[0].balance).toBeUndefined();
      expect(result.accountDetails.sender[0].accountType).toBeUndefined();
      expect(result.accountDetails.sender[0].amount).toBeUndefined();
      expect(result.accountDetails.sender[0].currency).toBeUndefined();
      expect(result.customerDetails[0].name).toBeUndefined();
      expect(result.address).toEqual([]);
    });

    it('should use source as customerId when customer is null', async () => {
      const accountNoCustomer = {
        ...mockAccount,
        customer: null,
      };
      (prismaDwh.transaction.findFirst as jest.Mock).mockResolvedValue(mockTransaction as any);
      (prismaDwh.account.findFirst as jest.Mock)
        .mockResolvedValueOnce(accountNoCustomer as any)
        .mockResolvedValueOnce(accountNoCustomer as any);

      const result = await service.getCustomerProfileByTransaction('tx-123');

      expect(result.customerDetails[0].customerId).toBe(mockTransaction.source);
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
      mockCustomerFind.mockResolvedValueOnce(null);
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(mockAccount as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerProfileById('acc-123');

      expect(result).toHaveProperty('customerId');
    });

    it('should throw InternalServerErrorException on database error', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getCustomerProfileById('customer-123')).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.customer.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfileById('customer-123')).rejects.toThrow(NotFoundException);
    });

    it('should return undefined address when customer address is null', async () => {
      const customerNoAddress = {
        ...mockCustomer,
        address: null,
        accounts: [
          {
            id: 'acc-123',
            account_type: null,
            opened_date: null,
            balance: null,
            risk_rating: null,
            customer_id: 'customer-123',
            tenant_id: 'tenant-123',
          },
        ],
      };
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(customerNoAddress as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.address).toBeUndefined();
      expect(result.accounts[0].accountType).toBeUndefined();
      expect(result.accounts[0].balance).toBeUndefined();
    });

    it('should return address object when customer address is present', async () => {
      const customerWithAddress = {
        ...mockCustomer,
        address: {
          street: '456 Oak St',
          city: 'Boston',
          state: 'MA',
          postalCode: '02101',
          country: 'USA',
        },
        accounts: [
          {
            ...mockCustomer.accounts[0],
            account_type: 'CHECKING',
            balance: { toNumber: () => 2500 },
          },
        ],
      };
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(customerWithAddress as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction] as any);

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.address).toEqual({
        street: '456 Oak St',
        city: 'Boston',
        state: 'MA',
        postalCode: '02101',
        country: 'USA',
      });
    });

    it('should assign undefined role when debtorCount and creditorCount are both 0', async () => {
      (prismaDwh.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([] as any); // no transactions

      const result: any = await service.getCustomerProfileById('customer-123');

      expect(result.accounts[0].role).toBeUndefined();
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

      await expect(service.getCustomerProfile('non-existent', 'tenant-123')).rejects.toThrow(NotFoundException);
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

      await expect(service.getCustomerProfile('customer-123', 'tenant-123')).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.customer.findUnique as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerProfile('customer-123', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should return undefined address when customer address is null', async () => {
      const customerNoAddress = {
        ...mockCustomer,
        address: null,
        accounts: [
          {
            id: 'acc-123',
            account_type: null,
            opened_date: null,
            balance: null,
            risk_rating: null,
          },
        ],
      };
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(customerNoAddress as any);

      const result = await service.getCustomerProfile('customer-123', 'tenant-123');

      expect(result.address).toBeUndefined();
      expect(result.accounts[0].accountType).toBeUndefined();
      expect(result.accounts[0].balance).toBeUndefined();
    });

    it('should return address object when customer address is present', async () => {
      const customerWithAddress = {
        ...mockCustomer,
        address: {
          street: '789 Pine St',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
          country: 'USA',
        },
      };
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(customerWithAddress as any);

      const result = await service.getCustomerProfile('customer-123', 'tenant-123');

      expect(result.address).toEqual({
        street: '789 Pine St',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'USA',
      });
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

      await expect(service.getCustomerByAccountId('non-existent')).rejects.toThrow(NotFoundException);
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

      await expect(service.getCustomerByAccountId('acc-123')).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Not found');
      (prismaDwh.account.findFirst as jest.Mock).mockRejectedValue(notFoundError);

      await expect(service.getCustomerByAccountId('acc-123')).rejects.toThrow(NotFoundException);
    });

    it('should assign Both role when debtor and creditor counts are equal', async () => {
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(mockAccount as any);
      const equalTxs = [
        { ...mockTransaction, source: 'acc-123', destination: 'other' },
        { ...mockTransaction, source: 'other', destination: 'acc-123' },
      ];
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue(equalTxs as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerByAccountId('acc-123');

      const accountRole = result.accounts.find((acc: any) => acc.id === 'acc-123')?.role;
      expect(accountRole).toBe('Both (Sender & Receiver)');
    });

    it('should handle account with no linked customer', async () => {
      const accountNoCustomer = {
        id: 'acc-orphan',
        account_type: null,
        opened_date: null,
        balance: null,
        risk_rating: null,
        customer_id: null,
        tenant_id: 'tenant-123',
        customer: null,
      };
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(accountNoCustomer as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([
        { ...mockTransaction, source: 'acc-orphan', destination: 'other' },
      ] as any);

      const result: any = await service.getCustomerByAccountId('acc-orphan');

      expect(result.customerId).toBe('acc-orphan'); // falls back to accountId
      expect(result.name).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.accounts[0].accountType).toBeUndefined();
      expect(result.accounts[0].balance).toBeUndefined();
      expect(result.accounts[0].role).toBe('Debtor (Sender/Payer)');
    });

    it('should handle case where customer_id is null but customer field is populated', async () => {
      const accountWithCustomerField = {
        ...mockAccount,
        customer_id: null,
        customer: mockCustomer, // customer field exists but customer_id is null
      };
      (prismaDwh.account.findFirst as jest.Mock).mockResolvedValue(accountWithCustomerField as any);
      (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValue([
        { ...mockTransaction, source: 'acc-123', destination: 'other' },
      ] as any);
      (prismaDwh.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer as any);

      const result: any = await service.getCustomerByAccountId('acc-123');

      expect(result).toHaveProperty('customerId');
    });
  });
});
