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
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
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
    expect(errors.some((error) => error.property === 'confidence_per')).toBe(true);
    expect(errors.some((error) => error.property === 'priority')).toBe(true);
  });

  it('should validate confidence_per with decimal precision', async () => {
    const decimalValues = [0.1, 15.5, 99.99, 33.333333];

    for (const confidence of decimalValues) {
      const validData = {
        confidence_per: confidence,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(confidence);
    }
  });

  it('should validate negative confidence_per values', async () => {
    const validData = {
      confidence_per: -50,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(-50);
  });

  it('should validate very large confidence_per values', async () => {
    const validData = {
      confidence_per: 999999.99,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(999999.99);
  });

  it('should fail validation when confidence_per is NaN', async () => {
    const invalidData = {
      confidence_per: NaN,
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
  });

  it('should fail validation when confidence_per is Infinity', async () => {
    const invalidData = {
      confidence_per: Infinity,
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
  });

  it('should fail validation when confidence_per is a string number', async () => {
    const invalidData = {
      confidence_per: '85',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
    expect(confidenceError?.constraints).toHaveProperty('isNumber');
  });

  it('should fail validation when priority is a number', async () => {
    const invalidData = {
      priority: 1,
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const priorityError = errors.find((error) => error.property === 'priority');
    expect(priorityError).toBeDefined();
    expect(priorityError?.constraints).toHaveProperty('isEnum');
  });

  it('should handle null values for optional fields', () => {
    const plainObject = {
      confidence_per: null,
      priority: null,
    };

    const dto = plainToClass(UpdateAlertDto, plainObject);

    expect(dto.confidence_per).toBeNull();
    expect(dto.priority).toBeNull();
  });

  it('should fail validation when priority is an object', async () => {
    const invalidData = {
      priority: { level: 'HIGH' },
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const priorityError = errors.find((error) => error.property === 'priority');
    expect(priorityError).toBeDefined();
    expect(priorityError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when confidence_per is an array', async () => {
    const invalidData = {
      confidence_per: [85],
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
    expect(confidenceError?.constraints).toHaveProperty('isNumber');
  });

  it('should validate with zero confidence_per', async () => {
    const validData = {
      confidence_per: 0,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(0);
  });

  it('should handle extra properties by including them in transformed object', async () => {
    const dataWithExtraProps = {
      confidence_per: 85,
      priority: Priority.HIGH,
      extraField: 'should be included',
      anotherField: 123,
    };

    const dto = plainToClass(UpdateAlertDto, dataWithExtraProps);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(85);
    expect(dto.priority).toBe(Priority.HIGH);
    // Extra fields are included by default in class-transformer
    expect((dto as any).extraField).toBe('should be included');
    expect((dto as any).anotherField).toBe(123);
  });

  it('should validate case sensitivity of Priority enum', async () => {
    const invalidData = {
      priority: 'high', // lowercase
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const priorityError = errors.find((error) => error.property === 'priority');
    expect(priorityError).toBeDefined();
    expect(priorityError?.constraints).toHaveProperty('isEnum');
  });
});
