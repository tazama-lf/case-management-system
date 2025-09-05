import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CloseAlertDto } from '../../../src/triage/dto/close-alert.dto';
import { CaseStatus } from '@prisma/client';

describe('CloseAlertDto', () => {
  it('should be defined', () => {
    expect(CloseAlertDto).toBeDefined();
  });

  it('should create an instance', () => {
    const dto = new CloseAlertDto();
    expect(dto).toBeInstanceOf(CloseAlertDto);
  });

  it('should validate a valid DTO', async () => {
    const dto = new CloseAlertDto();
    dto.status = CaseStatus.CLOSED_CONFIRMED_82;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);
  });

  it('should validate using plainToClass', async () => {
    const data = {
      status: CaseStatus.CLOSED_CONFIRMED_82,
    };

    const dto = plainToClass(CloseAlertDto, data);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);
  });

  describe('status validation', () => {
    it('should accept valid CaseStatus enum values', async () => {
      const validStatuses = [
        CaseStatus.CLOSED_CONFIRMED_82,
        CaseStatus.CLOSED_REFUTED_81,
        CaseStatus.CLOSED_INCONCLUSIVE_83,
        CaseStatus.AUTOCLOSED_CONFIRMED_71,
        CaseStatus.AUTOCLOSED_REFUTED_72,
        CaseStatus.ASSIGNED_10,
        CaseStatus.IN_PROGRESS_20,
        CaseStatus.READY_FOR_ASSIGNMENT_02
      ];

      for (const status of validStatuses) {
        const dto = new CloseAlertDto();
        dto.status = status;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(dto.status).toBe(status);
      }
    });

    it('should reject invalid status values', async () => {
      const dto = new CloseAlertDto();
      // @ts-expect-error - intentionally setting invalid value for testing
      dto.status = 'INVALID_STATUS';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject missing status', async () => {
      const dto = new CloseAlertDto();
      // Don't set status

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject null status', async () => {
      const dto = new CloseAlertDto();
      // @ts-expect-error - intentionally setting null value for testing
      dto.status = null;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject undefined status', async () => {
      const dto = new CloseAlertDto();
      // @ts-expect-error - intentionally setting undefined value for testing
      dto.status = undefined;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });
  });

  describe('DTO transformation and serialization', () => {
    it('should transform plain object to DTO instance', () => {
      const plainObject = {
        status: CaseStatus.CLOSED_REFUTED_81,
      };

      const dto = plainToClass(CloseAlertDto, plainObject);
      
      expect(dto).toBeInstanceOf(CloseAlertDto);
      expect(dto.status).toBe(CaseStatus.CLOSED_REFUTED_81);
    });

    it('should serialize DTO to JSON', () => {
      const dto = new CloseAlertDto();
      dto.status = CaseStatus.CLOSED_CONFIRMED_82;

      const serialized = JSON.stringify(dto);
      const parsed = JSON.parse(serialized);

      expect(parsed.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);
    });

    it('should handle different case status scenarios', async () => {
      const testCases = [
        { status: CaseStatus.CLOSED_CONFIRMED_82, description: 'closed confirmed case' },
        { status: CaseStatus.CLOSED_REFUTED_81, description: 'closed refuted case' },
        { status: CaseStatus.CLOSED_INCONCLUSIVE_83, description: 'closed inconclusive case' },
      ];

      for (const testCase of testCases) {
        const dto = plainToClass(CloseAlertDto, { status: testCase.status });
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.status).toBe(testCase.status);
      }
    });

    it('should support property enumeration', () => {
      const dto = new CloseAlertDto();
      dto.status = CaseStatus.CLOSED_CONFIRMED_82;

      const keys = Object.keys(dto);
      expect(keys).toContain('status');
    });

    it('should support different instantiation patterns', () => {
      // Direct instantiation
      const dto1 = new CloseAlertDto();
      dto1.status = CaseStatus.CLOSED_CONFIRMED_82;
      expect(dto1.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);

      // Object assign pattern
      const dto2 = Object.assign(new CloseAlertDto(), {
        status: CaseStatus.CLOSED_REFUTED_81
      });
      expect(dto2.status).toBe(CaseStatus.CLOSED_REFUTED_81);

      // plainToClass pattern
      const dto3 = plainToClass(CloseAlertDto, {
        status: CaseStatus.CLOSED_CONFIRMED_82
      });
      expect(dto3.status).toBe(CaseStatus.CLOSED_CONFIRMED_82);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object transformation', async () => {
      const dto = plainToClass(CloseAlertDto, {});
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'status')).toBeTruthy();
    });

    it('should maintain type safety', () => {
      const dto = new CloseAlertDto();
      dto.status = CaseStatus.CLOSED_CONFIRMED_82;

      // TypeScript should prevent this, but testing runtime behavior
      expect(typeof dto.status).toBe('string');
      expect(Object.values(CaseStatus)).toContain(dto.status);
    });

    it('should validate with partial data', async () => {
      const partialData = { status: CaseStatus.AUTOCLOSED_CONFIRMED_71 };
      const dto = plainToClass(CloseAlertDto, partialData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(CaseStatus.AUTOCLOSED_CONFIRMED_71);
    });
  });
});
