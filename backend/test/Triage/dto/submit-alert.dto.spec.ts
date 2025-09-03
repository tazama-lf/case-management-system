import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { SubmitAlertDto } from '../../../src/triage/dto/submit-alert.dto';

describe('SubmitAlertDto', () => {
  it('should be defined', () => {
    expect(SubmitAlertDto).toBeDefined();
  });

  it('should validate a valid DTO', async () => {
    const validData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message).toBe('Test alert message');
    expect(dto.report).toEqual({ test: 'report data' });
    expect(dto.transaction).toEqual({ test: 'transaction data' });
    expect(dto.networkMap).toEqual({ test: 'network data' });
  });

  it('should fail validation when message is missing', async () => {
    const invalidData = {
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find((error) => error.property === 'message');
    expect(messageError).toBeDefined();
    expect(messageError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when message is not a string', async () => {
    const invalidData = {
      message: 123,
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find((error) => error.property === 'message');
    expect(messageError).toBeDefined();
    expect(messageError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when report is missing', async () => {
    const invalidData = {
      message: 'Test alert message',
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reportError = errors.find((error) => error.property === 'report');
    expect(reportError).toBeDefined();
    expect(reportError?.constraints).toHaveProperty('isObject');
  });

  it('should fail validation when transaction is missing', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const transactionError = errors.find((error) => error.property === 'transaction');
    expect(transactionError).toBeDefined();
    expect(transactionError?.constraints).toHaveProperty('isObject');
  });

  it('should fail validation when networkMap is missing', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const networkMapError = errors.find((error) => error.property === 'networkMap');
    expect(networkMapError).toBeDefined();
    expect(networkMapError?.constraints).toHaveProperty('isObject');
  });

  it('should fail validation when report is not an object', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: 'not an object',
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reportError = errors.find((error) => error.property === 'report');
    expect(reportError).toBeDefined();
    expect(reportError?.constraints).toHaveProperty('isObject');
  });

  it('should fail validation when transaction is not an object', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      transaction: 'not an object',
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const transactionError = errors.find((error) => error.property === 'transaction');
    expect(transactionError).toBeDefined();
    expect(transactionError?.constraints).toHaveProperty('isObject');
  });

  it('should fail validation when networkMap is not an object', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: ['not', 'an', 'object'],
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const networkMapError = errors.find((error) => error.property === 'networkMap');
    expect(networkMapError).toBeDefined();
    expect(networkMapError?.constraints).toHaveProperty('isObject');
  });

  it('should handle complex nested objects', async () => {
    const complexData = {
      message: 'Complex alert message',
      report: {
        ruleId: 'RULE_001',
        score: 0.85,
        details: {
          subDetails: {
            level: 'high',
          },
        },
      },
      transaction: {
        id: 'txn_123',
        amount: 1000,
        currency: 'USD',
      },
      networkMap: {
        nodes: ['node1', 'node2'],
        edges: [{ from: 'node1', to: 'node2' }],
      },
    };

    const dto = plainToClass(SubmitAlertDto, complexData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.report).toEqual(complexData.report);
    expect(dto.transaction).toEqual(complexData.transaction);
    expect(dto.networkMap).toEqual(complexData.networkMap);
  });

  it('should handle empty objects for JSON fields', async () => {
    const validData = {
      message: 'Test alert message',
      report: {},
      transaction: {},
      networkMap: {},
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.report).toEqual({});
    expect(dto.transaction).toEqual({});
    expect(dto.networkMap).toEqual({});
  });

  it('should validate with very long message', async () => {
    const longMessage = 'A'.repeat(10000); // 10k character message
    const validData = {
      message: longMessage,
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message.length).toBe(10000);
  });

  it('should validate with empty string message', async () => {
    const validData = {
      message: '',
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message).toBe('');
  });

  it('should validate with unicode characters in strings', async () => {
    const validData = {
      message: '🚨 Alert with émojis and 中文 characters',
      report: { emoji: '💰', text: 'üñîçødé' },
      transaction: { currency: '€', description: 'Ñørmål tráñsäctîøñ' },
      networkMap: { node: '🌐', edge: '→' },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message).toBe('🚨 Alert with émojis and 中文 characters');
  });

  it('should validate deeply nested JSON objects', async () => {
    const validData = {
      message: 'Deep nesting test',
      report: {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deeply nested value',
                  array: [1, 2, { nested: 'object' }],
                },
              },
            },
          },
        },
      },
      transaction: {
        metadata: {
          tags: ['fraud', 'high-risk'],
          attributes: {
            amount: { value: 1000, currency: 'USD' },
            parties: {
              sender: { id: 'user123', verified: true },
              receiver: { id: 'user456', verified: false },
            },
          },
        },
      },
      networkMap: {
        graph: {
          nodes: [
            { id: 'n1', properties: { type: 'account', balance: 1000 } },
            { id: 'n2', properties: { type: 'transaction', amount: 500 } },
          ],
          edges: [{ from: 'n1', to: 'n2', properties: { weight: 0.8 } }],
        },
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.report).toEqual(validData.report);
    expect(dto.transaction).toEqual(validData.transaction);
    expect(dto.networkMap).toEqual(validData.networkMap);
  });

  it('should fail validation with multiple invalid fields', async () => {
    const invalidData = {
      message: 123, // Not a string
      report: 'not an object',
      transaction: 'not an object',
      networkMap: 'not an object',
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'message')).toBe(true);
    expect(errors.some((error) => error.property === 'report')).toBe(true);
    expect(errors.some((error) => error.property === 'transaction')).toBe(true);
    expect(errors.some((error) => error.property === 'networkMap')).toBe(true);
  });

  it('should handle null values for object fields', async () => {
    const invalidData = {
      message: 'Test alert message',
      report: null,
      transaction: null,
      networkMap: null,
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    // Null values should fail validation for @IsObject() decorated fields
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'report')).toBe(true);
    expect(errors.some((error) => error.property === 'transaction')).toBe(true);
    expect(errors.some((error) => error.property === 'networkMap')).toBe(true);
  });
});
