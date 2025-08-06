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
      },
    };

    const dto = plainToClass(SubmitAlertDto, complexData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.result.report).toEqual(complexData.result.report);
    expect(dto.result.transaction).toEqual(complexData.result.transaction);
    expect(dto.result.networkMap).toEqual(complexData.result.networkMap);
  });
});
