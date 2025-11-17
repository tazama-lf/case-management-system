import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { IngestAlertDto } from '../../../src/dtos/IngestAlert.dto';

describe('SubmitAlertDto', () => {
  it('should be defined', () => {
    expect(IngestAlertDto).toBeDefined();
  });

  it('should create an instance with all properties', () => {
    const dto = new IngestAlertDto();
    expect(dto).toBeInstanceOf(IngestAlertDto);
    expect(dto).toHaveProperty('message');
    expect(dto).toHaveProperty('report');
    expect(dto).toHaveProperty('transaction');
    expect(dto).toHaveProperty('networkMap');
  });

  it('should allow setting and getting all properties', () => {
    const dto = new IngestAlertDto();
    const testMessage = 'Test alert message';
    const testReport = { test: 'report data' };
    const testTransaction = { test: 'transaction data' };
    const testNetworkMap = { test: 'network data' };

    dto.message = testMessage;
    dto.report = testReport as any;
    dto.transaction = testTransaction as any;
    dto.networkMap = testNetworkMap as any;

    expect(dto.message).toBe(testMessage);
    expect(dto.report).toEqual(testReport);
    expect(dto.transaction).toEqual(testTransaction);
    expect(dto.networkMap).toEqual(testNetworkMap);
  });

  it('should validate class-validator decorators are applied', async () => {
    const dto = new IngestAlertDto();

    // Test that validation actually works (which proves decorators are applied)
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);

    // Test specific decorator behavior
    dto.message = 'valid string';
    dto.report = 'invalid object' as any;
    dto.transaction = {} as any;
    dto.networkMap = {} as any;

    const validationErrors = await validate(dto);
    const reportError = validationErrors.find((error) => error.property === 'report');
    expect(reportError?.constraints).toHaveProperty('isObject');
  });

  it('should validate a valid DTO', async () => {
    const validData = {
      message: 'Test alert message',
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(IngestAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message).toBe('Test alert message');
    expect(dto.report).toEqual({ test: 'report data' });
    expect(dto.transaction).toEqual({ test: 'transaction data' });
    expect(dto.networkMap).toEqual({ test: 'network data' });
  });

  it('should validate with direct property assignment', async () => {
    const dto = new IngestAlertDto();
    dto.message = 'Direct assignment message';
    dto.report = { type: 'test-report' } as any;
    dto.transaction = { TenantId: 'test-tenant', TxTp: 'payment' } as any;
    dto.networkMap = { nodes: [], edges: [] } as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should handle undefined values during validation', async () => {
    const dto = new IngestAlertDto();
    // Properties are undefined by default

    const errors = await validate(dto);

    // Should have validation errors for all required fields
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'message')).toBe(true);
    expect(errors.some((error) => error.property === 'report')).toBe(true);
    expect(errors.some((error) => error.property === 'transaction')).toBe(true);
    expect(errors.some((error) => error.property === 'networkMap')).toBe(true);
  });

  it('should fail validation when message is missing', async () => {
    const invalidData = {
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(IngestAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find((error) => error.property === 'message');
    expect(messageError).toBeDefined();
    expect(messageError?.constraints).toHaveProperty('isString');
  });

  it('should validate property types with class-transformer', () => {
    const data = {
      message: 'Test message',
      report: { evaluationID: 'test-123' },
      transaction: { TenantId: 'tenant-123', TxTp: 'payment' },
      networkMap: { nodes: ['node1'], edges: [] },
    };

    const dto = plainToClass(IngestAlertDto, data);

    // Verify transformation worked correctly
    expect(typeof dto.message).toBe('string');
    expect(typeof dto.report).toBe('object');
    expect(typeof dto.transaction).toBe('object');
    expect(typeof dto.networkMap).toBe('object');

    // Verify specific property values
    expect(dto.message).toBe('Test message');
    expect(dto.report).toHaveProperty('evaluationID');
    expect(dto.transaction).toHaveProperty('TenantId');
    expect(dto.networkMap).toHaveProperty('nodes');
  });

  it('should fail validation when message is not a string', async () => {
    const invalidData = {
      message: 123,
      report: { test: 'report data' },
      transaction: { test: 'transaction data' },
      networkMap: { test: 'network data' },
    };

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, complexData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.report).toEqual(complexData.report);
    expect(dto.transaction).toEqual(complexData.transaction);
    expect(dto.networkMap).toEqual(complexData.networkMap);
  });

  it('should validate with realistic Alert interface structure', async () => {
    const alertData = {
      message: 'Fraud alert detected',
      report: {
        evaluationID: 'eval-123',
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
        tadpResult: {
          ruleResults: [
            {
              ruleId: 'RULE_001',
              result: true,
              score: 0.95,
            },
          ],
        },
      },
      transaction: {
        TenantId: 'tenant-123',
        TxTp: 'PAYMENT',
      },
      networkMap: {
        nodes: [
          { id: 'account1', label: 'Source Account' },
          { id: 'account2', label: 'Destination Account' },
        ],
        edges: [{ source: 'account1', target: 'account2', amount: 1000 }],
      },
    };

    const dto = plainToClass(IngestAlertDto, alertData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.report).toHaveProperty('evaluationID');
    expect(dto.report).toHaveProperty('tadpResult');
    expect(dto.transaction).toHaveProperty('TenantId');
    expect(dto.networkMap).toHaveProperty('nodes');
    expect(dto.networkMap).toHaveProperty('edges');
  });

  it('should handle empty objects for JSON fields', async () => {
    const validData = {
      message: 'Test alert message',
      report: {},
      transaction: {},
      networkMap: {},
    };

    const dto = plainToClass(IngestAlertDto, validData);
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

    const dto = plainToClass(IngestAlertDto, validData);
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

    const dto = plainToClass(IngestAlertDto, validData);
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

    const dto = plainToClass(IngestAlertDto, validData);
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

    const dto = plainToClass(IngestAlertDto, validData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
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

    const dto = plainToClass(IngestAlertDto, invalidData);
    const errors = await validate(dto);

    // Null values should fail validation for @IsObject() decorated fields
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'report')).toBe(true);
    expect(errors.some((error) => error.property === 'transaction')).toBe(true);
    expect(errors.some((error) => error.property === 'networkMap')).toBe(true);
  });

  it('should handle property enumeration and serialization', () => {
    const dto = new IngestAlertDto();
    dto.message = 'Test message';
    dto.report = { evaluationID: 'test' } as any;
    dto.transaction = { TenantId: 'tenant' } as any;
    dto.networkMap = { nodes: [] } as any;

    // Test property enumeration
    const keys = Object.keys(dto);
    expect(keys).toContain('message');
    expect(keys).toContain('report');
    expect(keys).toContain('transaction');
    expect(keys).toContain('networkMap');

    // Test JSON serialization
    const serialized = JSON.stringify(dto);
    const parsed = JSON.parse(serialized);

    expect(parsed.message).toBe('Test message');
    expect(parsed.report).toEqual({ evaluationID: 'test' });
    expect(parsed.transaction).toEqual({ TenantId: 'tenant' });
    expect(parsed.networkMap).toEqual({ nodes: [] });
  });

  it('should support different instantiation patterns', () => {
    // Constructor pattern
    const dto1 = new IngestAlertDto();
    expect(dto1).toBeInstanceOf(IngestAlertDto);

    // Object.create pattern
    const dto2 = Object.create(IngestAlertDto.prototype);
    expect(dto2).toBeInstanceOf(IngestAlertDto);

    // plainToClass pattern (already tested but important for coverage)
    const dto3 = plainToClass(IngestAlertDto, {
      message: 'test',
      report: {},
      transaction: {},
      networkMap: {},
    });
    expect(dto3).toBeInstanceOf(IngestAlertDto);
  });

  it('should validate decorator behavior on each property', async () => {
    const dto = new IngestAlertDto();

    // Test @IsString on message
    dto.message = 123 as any;
    dto.report = {} as any;
    dto.transaction = {} as any;
    dto.networkMap = {} as any;

    let errors = await validate(dto);
    expect(errors.some((error) => error.property === 'message' && error.constraints?.isString)).toBe(true);

    // Test @IsObject on report
    dto.message = 'valid string';
    dto.report = 'not an object' as any;

    errors = await validate(dto);
    expect(errors.some((error) => error.property === 'report' && error.constraints?.isObject)).toBe(true);

    // Test @IsObject on transaction
    dto.report = {} as any;
    dto.transaction = 'not an object' as any;

    errors = await validate(dto);
    expect(errors.some((error) => error.property === 'transaction' && error.constraints?.isObject)).toBe(true);

    // Test @IsObject on networkMap
    dto.transaction = {} as any;
    dto.networkMap = 'not an object' as any;

    errors = await validate(dto);
    expect(errors.some((error) => error.property === 'networkMap' && error.constraints?.isObject)).toBe(true);
  });
});
