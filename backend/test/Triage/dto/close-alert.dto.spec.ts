import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CloseAlertDto } from '../../../src/triage/dto/close-alert.dto';
import { CaseStatus } from '@prisma/client';

describe('CloseAlertDto', () => {
  it('should be defined', () => {
    expect(CloseAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with reason and status', async () => {
    const validData = {
      reason: 'Alert resolved after investigation',
      status: CaseStatus.CLOSED_CONFIRMED_82,
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('Alert resolved after investigation');
    expect(dto.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);
  });

  it('should validate a valid DTO with reason only', async () => {
    const validData = {
      reason: 'Alert resolved after investigation',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('Alert resolved after investigation');
  });

  it('should validate a DTO with multiline reason', async () => {
    const validData = {
      reason: 'Alert closed due to:\n- False positive\n- Insufficient evidence\n- Duplicate of case #123',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toContain('False positive');
  });

  it('should validate a DTO with special characters in reason', async () => {
    const validData = {
      reason: 'Alert #456 closed at 2024-01-01T10:30:00Z due to user@domain.com verification',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('Alert #456 closed at 2024-01-01T10:30:00Z due to user@domain.com verification');
  });

  it('should validate a DTO with very long reason', async () => {
    const longReason = 'A'.repeat(1000); // 1000 character reason
    const validData = {
      reason: longReason,
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe(longReason);
    expect(dto.reason.length).toBe(1000);
  });

  it('should fail validation when reason is missing', async () => {
    const invalidData = {
      status: CaseStatus.CLOSED_CONFIRMED_82,
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when status is invalid', async () => {
    const invalidData = {
      reason: 'Valid reason',
      status: 'INVALID_STATUS',
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((error) => error.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('isEnum');
  });

  it('should validate with different valid CaseStatus values', async () => {
    const validStatuses = [
      CaseStatus.CLOSED_CONFIRMED_82,
      CaseStatus.CLOSED_REFUTED_81,
      CaseStatus.CLOSED_INCONCLUSIVE_83,
      CaseStatus.ABANDONED_99,
    ];

    for (const status of validStatuses) {
      const validData = {
        reason: `Alert closed with status ${status}`,
        status: status,
      };

      const dto = plainToClass(CloseAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(status);
    }
  });

  it('should fail validation when reason is not a string', async () => {
    const invalidData = {
      reason: 123,
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when reason is null', async () => {
    const invalidData = {
      reason: null,
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when reason is boolean', async () => {
    const invalidData = {
      reason: false,
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when reason is an object', async () => {
    const invalidData = {
      reason: { message: 'Invalid object' },
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should fail validation when reason is an array', async () => {
    const invalidData = {
      reason: ['reason1', 'reason2'],
    };

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
  });

  it('should validate an empty string reason', async () => {
    const validData = {
      reason: '',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('');
  });

  it('should validate a reason with only whitespace', async () => {
    const validData = {
      reason: '   \n\t  ',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('   \n\t  ');
  });

  it('should handle unicode characters in reason', async () => {
    const validData = {
      reason: '🚨 Alert closed due to émergency resolution 中文测试',
      status: CaseStatus.CLOSED_CONFIRMED_82, // Status is required
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('🚨 Alert closed due to émergency resolution 中文测试');
  });
});
