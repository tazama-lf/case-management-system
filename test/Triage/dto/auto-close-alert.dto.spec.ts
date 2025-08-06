import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AutoCloseAlertDto } from '../../../src/triage/dto/auto-close-alert.dto';
import { AlertStatus } from '@prisma/client';

describe('AutoCloseAlertDto', () => {
  it('should be defined', () => {
    expect(AutoCloseAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with AUTOCLOSED_CONFIRMED status', async () => {
    const validData = {
      status: AlertStatus.AUTOCLOSED_CONFIRMED,
    };

    const dto = plainToClass(AutoCloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(AlertStatus.AUTOCLOSED_CONFIRMED);
  });

  it('should validate a valid DTO with AUTOCLOSED_REFUTED status', async () => {
    const validData = {
      status: AlertStatus.AUTOCLOSED_REFUTED,
    };

    const dto = plainToClass(AutoCloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(AlertStatus.AUTOCLOSED_REFUTED);
  });

  it('should validate a valid DTO with NEW status', async () => {
    const validData = {
      status: AlertStatus.NEW,
    };

    const dto = plainToClass(AutoCloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(AlertStatus.NEW);
  });

  it('should fail validation when status is missing', async () => {
    const invalidData = {};

    const dto = plainToClass(AutoCloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when status is not a valid enum value', async () => {
    const invalidData = {
      status: 'INVALID_STATUS',
    };

    const dto = plainToClass(AutoCloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when status is a number', async () => {
    const invalidData = {
      status: 123,
    };

    const dto = plainToClass(AutoCloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when status is boolean', async () => {
    const invalidData = {
      status: true,
    };

    const dto = plainToClass(AutoCloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when status is null', async () => {
    const invalidData = {
      status: null,
    };

    const dto = plainToClass(AutoCloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should validate all valid AlertStatus enum values', async () => {
    const validStatuses = [
      AlertStatus.NEW,
      AlertStatus.AUTOCLOSED_CONFIRMED,
      AlertStatus.AUTOCLOSED_REFUTED,
    ];

    for (const status of validStatuses) {
      const validData = {
        status: status,
      };

      const dto = plainToClass(AutoCloseAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(status);
    }
  });

  it('should handle string representation of enum values', async () => {
    const validData = {
      status: 'AUTOCLOSED_CONFIRMED',
    };

    const dto = plainToClass(AutoCloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe('AUTOCLOSED_CONFIRMED');
  });
});
