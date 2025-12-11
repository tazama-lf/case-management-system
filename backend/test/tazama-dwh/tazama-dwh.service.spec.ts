import { Test, TestingModule } from '@nestjs/testing';
import { TazamaDwhService } from '../../src/tazama-dwh/tazama-dwh.service';
import { PrismaDWHService } from '../../prismaDWH/prismaDWH.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';
import { AuditLogService } from '../../src/audit/auditLog.service';

describe('TazamaDwhService', () => {
  let service: TazamaDwhService;
  let prismaDwh: PrismaDWHService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TazamaDwhService,
        {
          provide: PrismaDWHService,
          useValue: { transaction: { findMany: jest.fn() } },
        },
        { provide: LoggerService, useValue: { error: jest.fn() } },
        { provide: AuditLogService, useValue: { logAction: jest.fn() } },
      ],
    }).compile();

    service = module.get<TazamaDwhService>(TazamaDwhService);
    prismaDwh = module.get<PrismaDWHService>(PrismaDWHService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch transactions for last 90 days with no filters', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001' }, 'user1');
    expect(result.transactionTable?.length).toBe(1);
    expect(result.metrics.totalVolume).toBe(1);
  });

  it('should filter by creditorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001', filters: { creditorId: 'Retail Store LLC' } }, 'user1');
    expect(result.transactionTable?.[0]?.counterparty).toBe('Retail Store LLC');
  });

  it('should filter by debtorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001', filters: { debtorId: 'ACC-9012' } }, 'user1');
    expect(result.transactionTable?.[0]?.account).toBe('ACC-9012');
  });

  it('should filter by transaction type', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001', filters: { type: 'Withdrawal' } }, 'user1');
    expect(result.transactionTable?.[0]?.type).toBe('Withdrawal');
  });

  it('should filter by account', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001', filters: { account: 'ACC-9012' } }, 'user1');
    expect(result.transactionTable?.[0]?.account).toBe('ACC-9012');
  });

  it('should filter by role', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([
      { cre_dt_tm: '2025-11-28', end_to_end_id: 'TXN-000070', tx_tp: 'Withdrawal', source: 'ACC-9012', destination: 'Retail Store LLC', role: 'Creditor', amt: { toNumber: () => 3605.35 } },
    ]);
    const result = await service.generateProfile({ tenantId: 'T001', filters: { role: 'Creditor' } }, 'user1');
    expect(result.transactionTable?.[0]?.role).toBe('Creditor');
  });

  it('should call auditLog.logAction in generateProfile', async () => {
    const auditLog = { logAction: jest.fn() };
    const serviceWithAudit = new TazamaDwhService(prismaDwh, { error: jest.fn() } as any, auditLog as any);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([]);
    await serviceWithAudit.generateProfile({ tenantId: 'T001' }, 'user1');
    expect(auditLog.logAction).toHaveBeenCalled();
  });

  it('should throw NotFoundException in getTransactionsByDebtorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(service.getTransactionsByDebtorId('T001', 'ACC-0000')).rejects.toThrow('No transactions found for debtorId=ACC-0000');
  });

  it('should throw InternalServerErrorException in getTransactionsByDebtorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    await expect(service.getTransactionsByDebtorId('T001', 'ACC-0000')).rejects.toThrow('Failed to fetch transactions from DWH');
  });

  it('should throw NotFoundException in getTransactionsByCreditorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(service.getTransactionsByCreditorId('T001', 'Retail Store LLC')).rejects.toThrow('No transactions found for creditorId=Retail Store LLC');
  });

  it('should throw InternalServerErrorException in getTransactionsByCreditorId', async () => {
    (prismaDwh.transaction.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    await expect(service.getTransactionsByCreditorId('T001', 'Retail Store LLC')).rejects.toThrow('Failed to fetch transactions from DWH');
  });
});
