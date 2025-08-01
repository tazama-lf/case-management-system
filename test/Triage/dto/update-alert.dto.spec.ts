import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateAlertDto } from '../../../src/triage/dto/update-alert.dto';
import { Priority } from '@prisma/client';

describe('UpdateAlertDto', () => {
  it('should be defined', () => {
    expect(UpdateAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with all fields', async () => {
    const validData = {
      confidence_per: 85,
      priority: Priority.HIGH,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(85);
    expect(dto.priority).toBe(Priority.HIGH);
  });

  it('should validate a DTO with only confidence_per', async () => {
    const validData = {
      confidence_per: 75,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(75);
    expect(dto.priority).toBeUndefined();
  });

  it('should validate a DTO with only priority', async () => {
    const validData = {
      priority: Priority.MEDIUM,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBeUndefined();
    expect(dto.priority).toBe(Priority.MEDIUM);
  });

  it('should validate an empty DTO', async () => {
    const validData = {};

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBeUndefined();
    expect(dto.priority).toBeUndefined();
  });

  it('should fail validation when confidence_per is not a number', async () => {
    const invalidData = {
      confidence_per: 'not a number',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find(
      (error) => error.property === 'confidence_per',
    );
    expect(confidenceError).toBeDefined();
    expect(confidenceError?.constraints).toHaveProperty('isNumber');
  });

  it('should fail validation when priority is not a valid enum value', async () => {
    const invalidData = {
      priority: 'INVALID_PRIORITY',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const priorityError = errors.find((error) => error.property === 'priority');
    expect(priorityError).toBeDefined();
    expect(priorityError?.constraints).toHaveProperty('isEnum');
  });

  it('should validate with different priority values', async () => {
    const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];

    for (const priority of priorities) {
      const validData = {
        confidence_per: 50,
        priority: priority,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priority).toBe(priority);
    }
  });

  it('should handle edge case numeric values for confidence_per', async () => {
    const edgeCases = [0, 100, 50.5, 99.99];

    for (const confidence of edgeCases) {
      const validData = {
        confidence_per: confidence,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(confidence);
    }
  });

  it('should fail validation with boolean values', async () => {
    const invalidData = {
      confidence_per: true,
      priority: false,
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'confidence_per')).toBe(
      true,
    );
    expect(errors.some((error) => error.property === 'priority')).toBe(true);
  });
});
