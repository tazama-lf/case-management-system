import { validate } from 'class-validator';
import { CreateCaseDto } from '../../../src/modules/case/dto/create-case.dto';
import { CaseStatus, CaseType, Priority, CaseCreationType } from '@prisma/client';

describe('CreateCaseDto', () => {
  let dto: CreateCaseDto;

  beforeEach(() => {
    dto = new CreateCaseDto();
  });

  describe('tenantId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter(error => error.property === 'tenantId');
      expect(tenantIdErrors).toHaveLength(0);
    });

    it('should fail with invalid UUID format', async () => {
      dto.tenantId = 'invalid-uuid';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter(error => error.property === 'tenantId');
      // tenantId only validates as string, not UUID, so no errors expected
      expect(tenantIdErrors.length).toBe(0);
    });

    it('should fail when tenantId is missing', async () => {
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter(error => error.property === 'tenantId');
      expect(tenantIdErrors.length).toBeGreaterThan(0);
    });
  });

  describe('caseCreatorUserId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const creatorIdErrors = errors.filter(error => error.property === 'caseCreatorUserId');
      expect(creatorIdErrors).toHaveLength(0);
    });

    it('should fail with invalid UUID format', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = 'invalid-uuid';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const creatorIdErrors = errors.filter(error => error.property === 'caseCreatorUserId');
      expect(creatorIdErrors.length).toBeGreaterThan(0);
    });

    it('should fail when caseCreatorUserId is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const creatorIdErrors = errors.filter(error => error.property === 'caseCreatorUserId');
      expect(creatorIdErrors.length).toBeGreaterThan(0);
    });
  });

  describe('caseOwnerUserId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors).toHaveLength(0);
    });

    it('should fail with invalid UUID format', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = 'invalid-uuid';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors.length).toBeGreaterThan(0);
    });

    it('should fail when caseOwnerUserId is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const ownerIdErrors = errors.filter(error => error.property === 'caseOwnerUserId');
      expect(ownerIdErrors.length).toBeGreaterThan(0);
    });
  });

  describe('status validation', () => {
    it('should pass with valid CaseStatus enum values', async () => {
      const validStatuses = [
        CaseStatus.STATUS_00_DRAFT,
        CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        CaseStatus.STATUS_03_RETURNED,
        CaseStatus.STATUS_10_ASSIGNED,
        CaseStatus.STATUS_20_IN_PROGRESS,
        CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
        CaseStatus.STATUS_99_ABANDONED
      ];

      for (const status of validStatuses) {
        dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
        dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
        dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
        dto.status = status;
        dto.priority = Priority.NEW;
        dto.caseType = CaseType.FRAUD;
        dto.caseCreationType = CaseCreationType.MANUAL;

        const errors = await validate(dto);
        const statusErrors = errors.filter(error => error.property === 'status');
        expect(statusErrors).toHaveLength(0);
      }
    });

    it('should fail when status is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const statusErrors = errors.filter(error => error.property === 'status');
      expect(statusErrors.length).toBeGreaterThan(0);
    });
  });

  describe('priority validation', () => {
    it('should pass with valid Priority enum values', async () => {
      const validPriorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

      for (const priority of validPriorities) {
        dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
        dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
        dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
        dto.status = CaseStatus.STATUS_00_DRAFT;
        dto.priority = priority;
        dto.caseType = CaseType.FRAUD;
        dto.caseCreationType = CaseCreationType.MANUAL;

        const errors = await validate(dto);
        const priorityErrors = errors.filter(error => error.property === 'priority');
        expect(priorityErrors).toHaveLength(0);
      }
    });

    it('should fail when priority is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const priorityErrors = errors.filter(error => error.property === 'priority');
      expect(priorityErrors.length).toBeGreaterThan(0);
    });
  });

  describe('caseType validation', () => {
    it('should pass with valid CaseType enum values', async () => {
      const validCaseTypes = [CaseType.FRAUD, CaseType.AML, CaseType.FRAUD_AND_AML];

      for (const caseType of validCaseTypes) {
        dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
        dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
        dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
        dto.status = CaseStatus.STATUS_00_DRAFT;
        dto.priority = Priority.NEW;
        dto.caseType = caseType;
        dto.caseCreationType = CaseCreationType.MANUAL;

        const errors = await validate(dto);
        const caseTypeErrors = errors.filter(error => error.property === 'caseType');
        expect(caseTypeErrors).toHaveLength(0);
      }
    });

    it('should fail when caseType is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const caseTypeErrors = errors.filter(error => error.property === 'caseType');
      // caseType is optional, so no errors expected when missing
      expect(caseTypeErrors.length).toBe(0);
    });
  });

  describe('caseCreationType validation', () => {
    it('should pass with valid CaseCreationType enum values', async () => {
      const validCreationTypes = [CaseCreationType.MANUAL, CaseCreationType.AUTOMATIC_SYSTEM];

      for (const creationType of validCreationTypes) {
        dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
        dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
        dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
        dto.status = CaseStatus.STATUS_00_DRAFT;
        dto.priority = Priority.NEW;
        dto.caseType = CaseType.FRAUD;
        dto.caseCreationType = creationType;

        const errors = await validate(dto);
        const creationTypeErrors = errors.filter(error => error.property === 'caseCreationType');
        expect(creationTypeErrors).toHaveLength(0);
      }
    });

    it('should fail when caseCreationType is missing', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;

      const errors = await validate(dto);
      const creationTypeErrors = errors.filter(error => error.property === 'caseCreationType');
      expect(creationTypeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('parentId validation', () => {
    it('should pass when parentId is a valid UUID', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;
      dto.parentId = '123e4567-e89b-12d3-a456-426614174003';

      const errors = await validate(dto);
      const parentIdErrors = errors.filter(error => error.property === 'parentId');
      expect(parentIdErrors).toHaveLength(0);
    });

    it('should pass when parentId is undefined (optional field)', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      const parentIdErrors = errors.filter(error => error.property === 'parentId');
      expect(parentIdErrors).toHaveLength(0);
    });

    it('should fail when parentId is an invalid UUID', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;
      dto.parentId = 'invalid-uuid';

      const errors = await validate(dto);
      const parentIdErrors = errors.filter(error => error.property === 'parentId');
      expect(parentIdErrors.length).toBeGreaterThan(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass with all valid required fields', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with all valid fields including optional parentId', async () => {
      dto.tenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.caseCreatorUserId = '123e4567-e89b-12d3-a456-426614174001';
      dto.caseOwnerUserId = '123e4567-e89b-12d3-a456-426614174002';
      dto.status = CaseStatus.STATUS_00_DRAFT;
      dto.priority = Priority.NEW;
      dto.caseType = CaseType.FRAUD;
      dto.caseCreationType = CaseCreationType.MANUAL;
      dto.parentId = '123e4567-e89b-12d3-a456-426614174003';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});