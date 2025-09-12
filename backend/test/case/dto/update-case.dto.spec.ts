import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateCaseDto } from '../../../src/case/dto/update-case.dto';
import { CaseStatus, Priority, CaseType } from '@prisma/client';

describe('UpdateCaseDto', () => {
  it('should be defined', () => {
    const dto = new UpdateCaseDto();
    expect(dto).toBeDefined();
  });

  describe('status validation', () => {
    it('should accept valid CaseStatus enum values', async () => {
      const validStatuses = [
        CaseStatus.DRAFT_00,
        CaseStatus.PENDING_CASE_CREATION_APPROVAL_01,
        CaseStatus.READY_FOR_ASSIGNMENT_02,
        CaseStatus.RETURNED_03,
        CaseStatus.ASSIGNED_10,
        CaseStatus.IN_PROGRESS_20,
        CaseStatus.SUSPENDED_21,
        CaseStatus.PENDING_FINAL_APPROVAL_22,
        CaseStatus.PENDING_REOPENING_30,
        CaseStatus.REOPENED_31,
        CaseStatus.AUTOCLOSED_CONFIRMED_71,
        CaseStatus.AUTOCLOSED_REFUTED_72,
        CaseStatus.CLOSED_REFUTED_81,
        CaseStatus.CLOSED_CONFIRMED_82,
        CaseStatus.CLOSED_INCONCLUSIVE_83,
        CaseStatus.ABANDONED_99,
      ];

      for (const status of validStatuses) {
        const dto = plainToInstance(UpdateCaseDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid status value', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: 'INVALID_STATUS' as CaseStatus,
      });

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'status')).toBe(true);
    });

    it('should accept undefined status (optional)', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        priority: Priority.URGENT,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('priority validation', () => {
    it('should accept valid Priority enum values', async () => {
      const validPriorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

      for (const priority of validPriorities) {
        const dto = plainToInstance(UpdateCaseDto, { priority });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid priority value', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        priority: 'INVALID_PRIORITY' as Priority,
      });

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'priority')).toBe(true);
    });

    it('should accept undefined priority (optional)', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.IN_PROGRESS_20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('caseType validation', () => {
    it('should accept valid CaseType enum values', async () => {
      const validCaseTypes = [CaseType.FRAUD, CaseType.AML, CaseType.FRAUD_AND_AML];

      for (const caseType of validCaseTypes) {
        const dto = plainToInstance(UpdateCaseDto, { caseType });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid caseType value', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        caseType: 'INVALID_TYPE' as CaseType,
      });

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'caseType')).toBe(true);
    });

    it('should accept undefined caseType (optional)', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.ASSIGNED_10,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('caseOwnerUserId validation', () => {
    it('should accept valid UUID for caseOwnerUserId', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID for caseOwnerUserId', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        caseOwnerUserId: 'invalid-uuid',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseOwnerUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject empty string for caseOwnerUserId', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        caseOwnerUserId: '',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseOwnerUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should accept undefined caseOwnerUserId (optional)', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.ASSIGNED_10,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass validation with all valid optional fields', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.IN_PROGRESS_20,
        priority: Priority.URGENT,
        caseType: CaseType.FRAUD,
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with some optional fields', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.ASSIGNED_10,
        priority: Priority.CRITICAL,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with single field', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.CLOSED_CONFIRMED_82,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object (all fields optional)', async () => {
      const dto = plainToInstance(UpdateCaseDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with multiple invalid fields', async () => {
      // Create invalid data with proper typing
      const invalidData = {
        status: 'INVALID_STATUS' as CaseStatus,
        priority: 'INVALID_PRIORITY' as Priority,
        caseType: 'INVALID_TYPE' as CaseType,
        caseOwnerUserId: 'invalid-uuid',
      };

      const dto = plainToInstance(UpdateCaseDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);

      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('caseOwnerUserId');
    });

    it('should handle mixed valid and invalid fields', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.ASSIGNED_10, // valid
        priority: 'INVALID_PRIORITY' as Priority, // invalid
        caseType: CaseType.FRAUD, // valid
        caseOwnerUserId: 'invalid-uuid', // invalid
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('caseOwnerUserId');
    });
  });

  describe('property enumeration and access', () => {
    it('should properly handle property enumeration', () => {
      const testData = {
        status: CaseStatus.IN_PROGRESS_20,
        priority: Priority.URGENT,
        caseType: CaseType.FRAUD,
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const dto = plainToInstance(UpdateCaseDto, testData);

      // Safe property access
      const keys = Object.keys(dto);
      expect(keys.length).toBeGreaterThan(0);

      // Use Object.prototype.hasOwnProperty.call for safe property checking
      expect(Object.prototype.hasOwnProperty.call(dto, 'status')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(dto, 'priority')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(dto, 'caseType')).toBe(true);

      // Use Object.prototype.propertyIsEnumerable.call for safe enumerable checking
      expect(Object.prototype.propertyIsEnumerable.call(dto, 'status')).toBe(true);
    });

    it('should handle JSON serialization properly', () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: CaseStatus.ASSIGNED_10,
        priority: Priority.CRITICAL,
        caseType: CaseType.AML,
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000'
      });

      // Safely convert to JSON
      const jsonString = JSON.stringify(dto);
      expect(jsonString).toContain('ASSIGNED_10');
      expect(jsonString).toContain('CRITICAL');
      expect(jsonString).toContain('AML');

      // Parse back and verify
      const parsed = JSON.parse(jsonString);
      expect(parsed.status).toBe(CaseStatus.ASSIGNED_10);
      expect(parsed.priority).toBe(Priority.CRITICAL);
      expect(parsed.caseType).toBe(CaseType.AML);
    });

    it('should handle object creation and property assignment', () => {
      const dto = new UpdateCaseDto();

      // Assign properties individually
      dto.status = CaseStatus.IN_PROGRESS_20;
      dto.priority = Priority.URGENT;
      dto.caseType = CaseType.FRAUD_AND_AML;
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Verify assignments
      expect(dto.status).toBe(CaseStatus.IN_PROGRESS_20);
      expect(dto.priority).toBe(Priority.URGENT);
      expect(dto.caseType).toBe(CaseType.FRAUD_AND_AML);
      expect(dto.caseOwnerUserId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('edge cases and type safety', () => {
    it('should handle null and undefined values safely', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        status: null,
        priority: undefined,
        caseType: null,
        caseOwnerUserId: undefined,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate partial updates correctly', async () => {
      const partialUpdates = [
        { status: CaseStatus.ASSIGNED_10 },
        { priority: Priority.CRITICAL },
        { caseType: CaseType.AML },
        { caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000' },
      ];

      for (const update of partialUpdates) {
        const dto = plainToInstance(UpdateCaseDto, update);
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle enum boundary testing', async () => {
      // Test all enum values systematically
      const allCaseStatuses = Object.values(CaseStatus);
      const allPriorities = Object.values(Priority);
      const allCaseTypes = Object.values(CaseType);

      // Test with each enum value
      for (const status of allCaseStatuses) {
        const dto = plainToInstance(UpdateCaseDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }

      for (const priority of allPriorities) {
        const dto = plainToInstance(UpdateCaseDto, { priority });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }

      for (const caseType of allCaseTypes) {
        const dto = plainToInstance(UpdateCaseDto, { caseType });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });
});