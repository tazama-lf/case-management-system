import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConvertAlertToCase } from '../../../src/triage/dto/convert-alert-to-case.dto';
import { Priority, CaseType } from '@prisma/client';

describe('ConvertAlertToCase DTO', () => {
  it('should validate a valid ConvertAlertToCase DTO', async () => {
    const dto = plainToInstance(ConvertAlertToCase, {
      priority: Priority.HIGH,
      caseType: CaseType.FRAUD,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.priority).toBe(Priority.HIGH);
    expect(dto.caseType).toBe(CaseType.FRAUD);
  });

  it('should fail validation for invalid priority', async () => {
    const dto = plainToInstance(ConvertAlertToCase, {
      priority: 'INVALID_PRIORITY',
      caseType: CaseType.FRAUD,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('priority');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation for invalid caseType', async () => {
    const dto = plainToInstance(ConvertAlertToCase, {
      priority: Priority.HIGH,
      caseType: 'INVALID_CASE_TYPE',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation for missing priority', async () => {
    const dto = plainToInstance(ConvertAlertToCase, {
      caseType: CaseType.FRAUD,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('priority');
  });

  it('should fail validation for missing caseType', async () => {
    const dto = plainToInstance(ConvertAlertToCase, {
      priority: Priority.HIGH,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('caseType');
  });

  it('should accept all valid Priority values', async () => {
    const priorities = Object.values(Priority);

    for (const priority of priorities) {
      const dto = plainToInstance(ConvertAlertToCase, {
        priority,
        caseType: CaseType.FRAUD,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('should accept all valid CaseType values', async () => {
    const caseTypes = Object.values(CaseType);

    for (const caseType of caseTypes) {
      const dto = plainToInstance(ConvertAlertToCase, {
        priority: Priority.HIGH,
        caseType,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
