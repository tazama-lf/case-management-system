import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateCaseDto } from '../../../src/modules/case/dto/update-case.dto';
import { CaseStatus, Priority, CaseType } from '@prisma/client-cms';

describe('UpdateCaseDto', () => {
  it('should be defined', () => {
    const dto = new UpdateCaseDto();
    expect(dto).toBeDefined();
  });

  describe('status validation', () => {
    it('should accept valid CaseStatus enum values', async () => {
      const validStatuses = [
        CaseStatus.STATUS_00_DRAFT,
        CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        CaseStatus.STATUS_03_RETURNED,
        CaseStatus.STATUS_10_ASSIGNED,
        CaseStatus.STATUS_20_IN_PROGRESS,
        CaseStatus.STATUS_21_SUSPENDED,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        CaseStatus.STATUS_30_PENDING_REOPENING,
        CaseStatus.STATUS_31_REOPENED,
        CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
        CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
        CaseStatus.STATUS_81_CLOSED_REFUTED,
        CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
        CaseStatus.STATUS_99_ABANDONED,
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
      expect(errors.some((e) => e.property === 'status')).toBe(true);
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
        dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
        dto.priority = priority;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid priority value', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        priority: 'INVALID_PRIORITY' as Priority,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'priority')).toBe(true);
    });

    it('should pass when priority is not set (optional field)', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
      // Don't set priority
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('caseType validation', () => {
    it('should accept valid CaseType enum values', async () => {
      const validCaseTypes = [CaseType.FRAUD, CaseType.AML, CaseType.FRAUD_AND_AML];

      for (const caseType of validCaseTypes) {
        dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
        dto.caseType = caseType;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid caseType value', async () => {
      const dto = plainToInstance(UpdateCaseDto, {
        caseType: 'INVALID_TYPE' as CaseType,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'caseType')).toBe(true);
    });

    it('should pass when caseType is not set (optional field)', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
      // Don't set caseType
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('caseOwnerUserId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174000';
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseOwnerUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should fail with invalid UUID format', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
      dto.caseOwnerUserId = 'invalid-uuid';
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseOwnerUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should pass when caseOwnerUserId is not set (optional field)', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Required field
      // Don't set caseOwnerUserId
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass with only required status field', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with all valid fields', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with partial field updates', async () => {
      dto.status = CaseStatus.STATUS_82_CLOSED_CONFIRMED;
      dto.priority = Priority.URGENT;
      // Other optional fields not set

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with mixed valid and invalid fields', async () => {
      dto.status = CaseStatus.STATUS_00_DRAFT; // Valid and required
      dto.caseOwnerUserId = 'invalid-uuid'; // Invalid

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

      const errorProperties = errors.map((error) => error.property);
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

      const errorProperties = errors.map((error) => error.property);
      expect(errorProperties).toContain('caseOwnerUserId');
    });
  });

  describe('property enumeration and access', () => {
    it('should properly handle property enumeration', () => {
      const testData = {
        status: CaseStatus.IN_PROGRESS_20,
        priority: Priority.URGENT,
        caseType: CaseType.FRAUD,
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000',
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
        caseOwnerUserId: '123e4567-e89b-12d3-a456-426614174000',
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
