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
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: CaseType.FRAUD,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe(CaseType.FRAUD);
  });

  it('should validate a valid DTO with MONEY_LAUNDERING case type', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: CaseType.MONEY_LAUNDERING,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe(CaseType.MONEY_LAUNDERING);
  });

  it('should fail validation when caseType is missing', async () => {
    const dto = plainToClass(InvestigateAlertDto, {});

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is not a valid enum value', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: 'INVALID_TYPE',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is a number', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is boolean', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: true,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when caseType is null', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: null,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should validate all valid CaseType enum values', async () => {
    const validCaseTypes = Object.values(CaseType);
    
    for (const caseType of validCaseTypes) {
      const dto = plainToClass(InvestigateAlertDto, { caseType });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.caseType).toBe(caseType);
    }
  });

  it('should handle string representation of enum values', async () => {
    const dto = plainToClass(InvestigateAlertDto, {
      caseType: 'FRAUD',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.caseType).toBe('FRAUD');
  });
});
