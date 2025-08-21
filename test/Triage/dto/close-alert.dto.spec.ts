import 'reflect-metadata';
import { validate } from 'class-validator';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CloseAlertDto } from '../../../src/triage/dto/close-alert.dto';

describe('CloseAlertDto', () => {
  it('should be defined', () => {
    expect(CloseAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with reason', async () => {
    const validData = {
      reason: 'Alert resolved after investigation',
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('Alert resolved after investigation');
  });

  it('should validate a DTO with multiline reason', async () => {
    const validData = {
      reason: 'Alert closed due to:\n- False positive\n- Insufficient evidence\n- Duplicate of case #123',
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toContain('False positive');
  });

  it('should validate a DTO with special characters in reason', async () => {
    const validData = {
      reason: 'Alert #456 closed at 2024-01-01T10:30:00Z due to user@domain.com verification',
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
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe(longReason);
    expect(dto.reason.length).toBe(1000);
  });

  it('should fail validation when reason is missing', async () => {
    const invalidData = {};

    const dto = plainToClass(CloseAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((error) => error.property === 'reason');
    expect(reasonError).toBeDefined();
    expect(reasonError?.constraints).toHaveProperty('isString');
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
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('');
  });

  it('should validate a reason with only whitespace', async () => {
    const validData = {
      reason: '   \n\t  ',
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('   \n\t  ');
  });

  it('should handle unicode characters in reason', async () => {
    const validData = {
      reason: '🚨 Alert closed due to émergency resolution 中文测试',
    };

    const dto = plainToClass(CloseAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('🚨 Alert closed due to émergency resolution 中文测试');
  });

  it('should allow direct instantiation and validate successfully', async () => {
    const dto = new CloseAlertDto();
    dto.reason = 'Closed after manual review';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('Closed after manual review');
  });

  it('should fail synchronous validation for non-string reason', () => {
    const dto: any = new CloseAlertDto();
    dto.reason = 42;

    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const reasonError = errors.find((e) => e.property === 'reason');
    expect(reasonError?.constraints).toHaveProperty('isString');
  });
});
