import { TransactionDto, DWHAccountTransactionsResponseDto } from '../../src/tazama-dwh/dto/tazama-dwh.dto';

describe('TransactionDto', () => {
  it('should create an instance with all properties', () => {
    const tx = new TransactionDto();
    tx.date = '2025-11-28';
    tx.transactionId = 'TXN-000070';
    tx.type = 'Withdrawal';
    tx.account = 'ACC-9012';
    tx.counterparty = 'Retail Store LLC';
    tx.role = 'CREDITOR';
    tx.amount = 3605.35;
    tx.currency = 'USD';
    expect(tx.date).toBe('2025-11-28');
    expect(tx.transactionId).toBe('TXN-000070');
    expect(tx.type).toBe('Withdrawal');
    expect(tx.account).toBe('ACC-9012');
    expect(tx.counterparty).toBe('Retail Store LLC');
    expect(tx.role).toBe('CREDITOR');
    expect(tx.amount).toBe(3605.35);
    expect(tx.currency).toBe('USD');
  });

  it('should allow partial properties', () => {
    const tx = new TransactionDto();
    tx.transactionId = 'TXN-000071';
    expect(tx.transactionId).toBe('TXN-000071');
    expect(tx.account).toBeUndefined();
  });
});

describe('DWHAccountTransactionsResponseDto', () => {
  it('should create an instance with all properties', () => {
    const tx = new TransactionDto();
    tx.transactionId = 'TXN-000070';
    const resp = new DWHAccountTransactionsResponseDto();
    resp.accountId = 'ACC-9012';
    resp.tenantId = 'T001';
    resp.transactions = [tx];
    expect(resp.accountId).toBe('ACC-9012');
    expect(resp.tenantId).toBe('T001');
    expect(resp.transactions.length).toBe(1);
    expect(resp.transactions[0].transactionId).toBe('TXN-000070');
  });
});