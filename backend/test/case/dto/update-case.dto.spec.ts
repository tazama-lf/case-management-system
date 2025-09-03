import { validate } from 'class-validator';
import { UpdateCaseDto } from '../../../src/case/dto/update-case.dto';
import { CaseStatus, CaseType, Priority } from '@prisma/client';

describe('UpdateCaseDto', () => {
  let dto: UpdateCaseDto;

  beforeEach(() => {
    dto = new UpdateCaseDto();
  });

  describe('status validation', () => {
    it('should pass with valid CaseStatus enum values', async () => {
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
        CaseStatus.ABANDONED_99
      ];

      for (const status of validStatuses) {
        dto.status = status;
        const errors = await validate(dto);
        const statusErrors = errors.filter(error => error.property === 'status');
        expect(statusErrors).toHaveLength(0);
      }
    });

    it('should fail when status is missing (required field)', async () => {
      // Don't set status to test validation failure
      const errors = await validate(dto);
      const statusErrors = errors.filter(error => error.property === 'status');
      expect(statusErrors.length).toBeGreaterThan(0);
    });
  });

  describe('priority validation', () => {
    it('should pass with valid Priority enum values', async () => {
      const validPriorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

      for (const priority of validPriorities) {
        dto.status = CaseStatus.DRAFT_00; // Required field
        dto.priority = priority;
        const errors = await validate(dto);
        const priorityErrors = errors.filter(error => error.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      }
    });

    it('should pass when priority is not set (optional field)', async () => {
      dto.status = CaseStatus.DRAFT_00; // Required field
      // Don't set priority
      const errors = await validate(dto);
      const priorityErrors = errors.filter(error => error.property === 'priority');
      expect(priorityErrors).toHaveLength(0);
    });
  });

  describe('caseType validation', () => {
    it('should pass with valid CaseType enum values', async () => {
      const validCaseTypes = [CaseType.FRAUD, CaseType.AML, CaseType.FRAUD_AND_AML];

      for (const caseType of validCaseTypes) {
        dto.status = CaseStatus.DRAFT_00; // Required field
        dto.caseType = caseType;
        const errors = await validate(dto);
        const caseTypeErrors = errors.filter(error => error.property === 'caseType');
        expect(caseTypeErrors).toHaveLength(0);
      }
    });

    it('should pass when caseType is not set (optional field)', async () => {
      dto.status = CaseStatus.DRAFT_00; // Required field
      // Don't set caseType
      const errors = await validate(dto);
      const caseTypeErrors = errors.filter(error => error.property === 'caseType');
      expect(caseTypeErrors).toHaveLength(0);
    });
  });

  describe('caseOwnerUserId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.status = CaseStatus.DRAFT_00; // Required field
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174000';
      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors).toHaveLength(0);
    });

    it('should fail with invalid UUID format', async () => {
      dto.status = CaseStatus.DRAFT_00; // Required field
      dto.caseOwnerUserId = 'invalid-uuid';
      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors.length).toBeGreaterThan(0);
    });

    it('should pass when caseOwnerUserId is not set (optional field)', async () => {
      dto.status = CaseStatus.DRAFT_00; // Required field
      // Don't set caseOwnerUserId
      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors).toHaveLength(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass with only required status field', async () => {
      dto.status = CaseStatus.DRAFT_00;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with all valid fields', async () => {
      dto.status = CaseStatus.DRAFT_00;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with partial field updates', async () => {
      dto.status = CaseStatus.CLOSED_CONFIRMED_82;
      dto.priority = Priority.URGENT;
      // Other optional fields not set

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with mixed valid and invalid fields', async () => {
      dto.status = CaseStatus.DRAFT_00; // Valid and required
      dto.caseOwnerUserId = 'invalid-uuid'; // Invalid

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors.length).toBeGreaterThan(0);
      
      const statusErrors = errors.filter(error => error.property === 'status');
      expect(statusErrors).toHaveLength(0);
    });

    it('should fail when required status field is missing', async () => {
      // Set optional fields but not required status
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const statusErrors = errors.filter(error => error.property === 'status');
      expect(statusErrors.length).toBeGreaterThan(0);
    });
  });

  describe('enum value validation', () => {
    it('should fail with invalid enum values', async () => {
      const invalidDto = {
        status: 'INVALID_STATUS',
        priority: 'INVALID_PRIORITY',
        caseType: 'INVALID_TYPE'
      };

      const errors = await validate(Object.assign(new UpdateCaseDto(), invalidDto));
      expect(errors.length).toBeGreaterThan(0);

      const statusErrors = errors.filter(error => error.property === 'status');
      const priorityErrors = errors.filter(error => error.property === 'priority');
      const caseTypeErrors = errors.filter(error => error.property === 'caseType');

      expect(statusErrors.length).toBeGreaterThan(0);
      expect(priorityErrors.length).toBeGreaterThan(0);
      expect(caseTypeErrors.length).toBeGreaterThan(0);
    });
  });
});
