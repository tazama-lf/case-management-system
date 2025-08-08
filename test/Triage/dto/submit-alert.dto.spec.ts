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
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.message).toBe('Test alert message');
    expect(dto.result.source).toBe('test-source');
    expect(dto.result.report).toEqual({ test: 'report data' });
    expect(dto.result.transaction).toEqual({ test: 'transaction data' });
    expect(dto.result.networkMap).toEqual({ test: 'network data' });
    expect(dto.result.txtp).toBe('test-txtp');
  });

  it('should fail validation when result is missing', async () => {
    const invalidData = {};

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('result');
  });

  it('should fail validation when result.message is not a string', async () => {
    const invalidData = {
      result: {
        message: 123,
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should fail validation when result.source is not a string', async () => {
    const invalidData = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 123,
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should fail validation when report is not an object', async () => {
    const invalidData = {
      result: {
        message: 'Test alert message',
        report: 'not an object',
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should handle complex nested objects', async () => {
    const complexData = {
      result: {
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
        source: 'fraud-detection-engine',
        txtp: 'complex-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, complexData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.report).toEqual(complexData.result.report);
    expect(dto.result.transaction).toEqual(complexData.result.transaction);
    expect(dto.result.networkMap).toEqual(complexData.result.networkMap);
  });

  it('should fail validation when transaction is not an object', async () => {
    const invalidData = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: 'not an object',
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should fail validation when networkMap is not an object', async () => {
    const invalidData = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: ['not', 'an', 'object'],
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should fail validation when message is missing', async () => {
    const invalidData = {
      result: {
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should fail validation when source is missing', async () => {
    const invalidData = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const resultErrors = errors.find((error) => error.property === 'result');
    expect(resultErrors).toBeDefined();
  });

  it('should handle empty objects for JSON fields', async () => {
    const validData = {
      result: {
        message: 'Test alert message',
        report: {},
        transaction: {},
        networkMap: {},
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.report).toEqual({});
    expect(dto.result.transaction).toEqual({});
    expect(dto.result.networkMap).toEqual({});
  });

  it('should handle null values for optional JSON fields gracefully', async () => {
    const validData = {
      result: {
        message: 'Test alert message',
        report: null,
        transaction: null,
        networkMap: null,
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    // This test checks current behavior - might need adjustment based on validation rules
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should validate with very long message', async () => {
    const longMessage = 'A'.repeat(10000); // 10k character message
    const validData = {
      result: {
        message: longMessage,
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.message.length).toBe(10000);
  });

  it('should validate with empty string message', async () => {
    const validData = {
      result: {
        message: '',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
        txtp: 'test-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.message).toBe('');
  });

  it('should validate with unicode characters in strings', async () => {
    const validData = {
      result: {
        message: '🚨 Alert with émojis and 中文 characters',
        report: { emoji: '💰', text: 'üñîçødé' },
        transaction: { currency: '€', description: 'Ñørmål tráñsäctîøñ' },
        networkMap: { node: '🌐', edge: '→' },
        source: 'système-détection-fraude',
        txtp: 'unicode-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.message).toBe('🚨 Alert with émojis and 中文 characters');
    expect(dto.result.source).toBe('système-détection-fraude');
  });

  it('should validate deeply nested JSON objects', async () => {
    const validData = {
      result: {
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
        source: 'advanced-ml-engine',
        txtp: 'deep-txtp',
      },
    };

    const dto = plainToClass(SubmitAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.report).toEqual(validData.result.report);
    expect(dto.result.transaction).toEqual(validData.result.transaction);
    expect(dto.result.networkMap).toEqual(validData.result.networkMap);
  });
});
