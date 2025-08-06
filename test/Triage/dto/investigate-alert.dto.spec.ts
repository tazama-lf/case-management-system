import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { InvestigateAlertDto } from '../../../src/triage/dto/investigate-alert-dto';
import { CaseType } from '@prisma/client';

describe('InvestigateAlertDto', () => {
  it('should be defined', () => {
    expect(InvestigateAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with FRAUD case type', async () => {
    const validData = {
      caseType: CaseType.FRAUD,
    };

    const dto = plainToClass(InvestigateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe(CaseType.FRAUD);
  });

  it('should validate a valid DTO with MONEY_LAUNDERING case type', async () => {
    const validData = {
      caseType: CaseType.MONEY_LAUNDERING,
    };

    const dto = plainToClass(InvestigateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe(CaseType.MONEY_LAUNDERING);
  });

  it('should validate all valid CaseType enum values', async () => {
    const validCaseTypes = Object.values(CaseType);

    for (const caseType of validCaseTypes) {
      const validData = {
        caseType: caseType,
      };

      const dto = plainToClass(InvestigateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.caseType).toBe(caseType);
    }
  });

  it('should transform string values to enum', async () => {
    const validData = {
      caseType: 'FRAUD',
    };

    const dto = plainToClass(InvestigateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe('FRAUD');
  });

  it('should fail validation when caseType is missing', async () => {
    const invalidData = {};

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is not a valid enum value', async () => {
    const invalidData = {
      caseType: 'INVALID_CASE_TYPE',
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is a number', async () => {
    const invalidData = {
      caseType: 123,
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is boolean', async () => {
    const invalidData = {
      caseType: true,
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is null', async () => {
    const invalidData = {
      caseType: null,
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is an object', async () => {
    const invalidData = {
      caseType: { type: 'FRAUD' },
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is an array', async () => {
    const invalidData = {
      caseType: ['FRAUD', 'MONEY_LAUNDERING'],
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation with empty string', async () => {
    const invalidData = {
      caseType: '',
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation with case-sensitive values', async () => {
    const invalidData = {
      caseType: 'fraud', // lowercase
    };

    const dto = plainToClass(InvestigateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const caseTypeError = errors.find((error) => error.property === 'caseType');
    expect(caseTypeError).toBeDefined();
    expect(caseTypeError?.constraints).toHaveProperty('isEnum');
  });
});
