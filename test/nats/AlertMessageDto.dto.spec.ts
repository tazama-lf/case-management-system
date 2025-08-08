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
  });

  it('should validate required fields only', async () => {
    const minimalData = {
      tenant_id: 'test-tenant',
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
});
