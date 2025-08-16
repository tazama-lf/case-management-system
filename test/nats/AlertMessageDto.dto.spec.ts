import 'reflect-metadata';
import { Priority, AlertStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AlertMessageDto } from '../../src/nats/dto/AlertMessageDto.dto';

describe('AlertMessageDto', () => {
  it('should be defined', () => {
    expect(AlertMessageDto).toBeDefined();
  });

  it('should create an instance', () => {
    const dto = new AlertMessageDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(AlertMessageDto);
  });

  it('should validate a complete valid DTO', async () => {
    const alertData = {
      tenant_id: 'test-tenant',
      priority: Priority.HIGH,
      source: 'test-source',
      txtp: 'test-txtp',
      message: 'Test alert message',
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      alert_status: AlertStatus.NEW,
      confidence_per: 85,
      case_id: 'test-case-123',
      userId: 'test-user',
    };

    const dto = plainToClass(AlertMessageDto, alertData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.tenant_id).toBe('test-tenant');
    expect(dto.priority).toBe(Priority.HIGH);
    expect(dto.source).toBe('test-source');
    expect(dto.txtp).toBe('test-txtp');
    expect(dto.message).toBe('Test alert message');
    expect(dto.alert_data).toEqual({ test: 'data' });
    expect(dto.transaction).toEqual({ test: 'transaction' });
    expect(dto.network_map).toEqual({ test: 'network' });
    expect(dto.alert_status).toBe(AlertStatus.NEW);
    expect(dto.confidence_per).toBe(85);
    expect(dto.case_id).toBe('test-case-123');
    expect(dto.userId).toBe('test-user');
  });

  it('should validate userId field', async () => {
    const data = {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      userId: 'user-123',
    };
    const dto = plainToClass(AlertMessageDto, data);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.userId).toBe('user-123');
  });

  it('should validate required fields only', async () => {
    const minimalData = {
      tenant_id: 'test-tenant',
      source: 'test-source',
      message: 'Test alert message',
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      confidence_per: 75,
    };

    const dto = plainToClass(AlertMessageDto, minimalData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should validate all Priority enum values', async () => {
    const priorities = Object.values(Priority);

    for (const priority of priorities) {
      const dto = plainToClass(AlertMessageDto, {
        tenant_id: 'test-tenant',
        source: 'test-source',
        message: 'Test message',
        alert_data: {},
        transaction: {},
        network_map: {},
        confidence_per: 50,
        priority: priority,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.priority).toBe(priority);
    }
  });

  it('should validate all AlertStatus enum values', async () => {
    const statuses = Object.values(AlertStatus);

    for (const status of statuses) {
      const dto = plainToClass(AlertMessageDto, {
        tenant_id: 'test-tenant',
        message: 'Test message',
        alert_data: {},
        transaction: {},
        network_map: {},
        confidence_per: 50,
        alert_status: status,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.alert_status).toBe(status);
    }
  });

  it('should fail validation for missing required fields', async () => {
    const invalidData = {
      priority: Priority.HIGH,
      // Missing required fields: tenant_id, message, alert_data, transaction, network_map, confidence_per
    };

    const dto = plainToClass(AlertMessageDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation for invalid priority', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      priority: 'INVALID_PRIORITY',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation for invalid alert_status', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      alert_status: 'INVALID_STATUS',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should transform string values properly', () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      priority: 'HIGH',
      alert_status: 'NEW',
    });

    expect(dto.priority).toBe('HIGH');
    expect(dto.alert_status).toBe('NEW');
  });

  // Additional tests for better coverage
  it('should fail validation for invalid confidence_per type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 'invalid-number',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
  });

  it('should fail validation for invalid tenant_id type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 123, // should be string
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const tenantError = errors.find((error) => error.property === 'tenant_id');
    expect(tenantError).toBeDefined();
  });

  it('should fail validation for invalid message type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 123, // should be string
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find((error) => error.property === 'message');
    expect(messageError).toBeDefined();
  });

  it('should fail validation for invalid alert_data type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: 'not-an-object',
      transaction: {},
      network_map: {},
      confidence_per: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const alertDataError = errors.find((error) => error.property === 'alert_data');
    expect(alertDataError).toBeDefined();
  });

  it('should fail validation for invalid transaction type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: 'not-an-object',
      network_map: {},
      confidence_per: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const transactionError = errors.find((error) => error.property === 'transaction');
    expect(transactionError).toBeDefined();
  });

  it('should fail validation for invalid network_map type', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: 'not-an-object',
      confidence_per: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const networkMapError = errors.find((error) => error.property === 'network_map');
    expect(networkMapError).toBeDefined();
  });

  it('should validate optional fields with valid values', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      priority: Priority.MEDIUM,
      alert_status: AlertStatus.CONVERTED,
      case_id: 'case-456',
      userId: 'user-789',
      source: 'fraud-detection',
      txtp: 'payment-transfer',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.priority).toBe(Priority.MEDIUM);
    expect(dto.alert_status).toBe(AlertStatus.CONVERTED);
    expect(dto.case_id).toBe('case-456');
    expect(dto.userId).toBe('user-789');
    expect(dto.source).toBe('fraud-detection');
    expect(dto.txtp).toBe('payment-transfer');
  });

  it('should fail validation for invalid optional string fields', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      case_id: 123, // should be string
      userId: 456, // should be string
      source: 789, // should be string
      txtp: 101112, // should be string
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);

    const caseIdError = errors.find((error) => error.property === 'case_id');
    const userIdError = errors.find((error) => error.property === 'userId');
    const sourceError = errors.find((error) => error.property === 'source');
    const txtpError = errors.find((error) => error.property === 'txtp');

    expect(caseIdError).toBeDefined();
    expect(userIdError).toBeDefined();
    expect(sourceError).toBeDefined();
    expect(txtpError).toBeDefined();
  });

  it('should handle null values for optional fields', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      priority: null,
      alert_status: null,
      case_id: null,
      userId: null,
      source: null,
      txtp: null,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should handle undefined values for optional fields', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 50,
      priority: undefined,
      alert_status: undefined,
      case_id: undefined,
      userId: undefined,
      source: undefined,
      txtp: undefined,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate complex nested objects', async () => {
    const complexAlertData = {
      ruleId: 'rule-123',
      score: 95.5,
      metadata: {
        nested: {
          deep: 'value',
        },
      },
    };

    const complexTransaction = {
      id: 'tx-456',
      amount: 1000.5,
      currency: 'USD',
      participants: ['sender', 'receiver'],
    };

    const complexNetworkMap = {
      nodes: [
        { id: 'node1', type: 'account' },
        { id: 'node2', type: 'transaction' },
      ],
      edges: [{ from: 'node1', to: 'node2', weight: 0.8 }],
    };

    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Complex alert message',
      alert_data: complexAlertData,
      transaction: complexTransaction,
      network_map: complexNetworkMap,
      confidence_per: 95,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.alert_data).toEqual(complexAlertData);
    expect(dto.transaction).toEqual(complexTransaction);
    expect(dto.network_map).toEqual(complexNetworkMap);
  });
});
