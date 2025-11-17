import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTaskDto } from '../../../src/modules/task/dto/create-task.dto';
import { TaskStatus } from '@prisma/client';

describe('CreateTaskDto', () => {
  it('should be defined', () => {
    const dto = new CreateTaskDto();
    expect(dto).toBeDefined();
  });

  describe('caseId validation', () => {
    it('should accept valid UUID for caseId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID for caseId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: 'invalid-uuid',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject empty caseId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject missing caseId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('caseId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });
  });

  describe('assignedUserId validation', () => {
    it('should accept valid UUID for assignedUserId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID for assignedUserId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: 'invalid-uuid',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('assignedUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject empty assignedUserId', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('assignedUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should accept missing assignedUserId (optional)', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('status validation', () => {
    it('should accept valid TaskStatus enum values', async () => {
      const validStatuses = [
        TaskStatus.STATUS_01_UNASSIGNED,
        TaskStatus.STATUS_10_ASSIGNED,
        TaskStatus.STATUS_20_IN_PROGRESS,
        TaskStatus.STATUS_30_COMPLETED,
        TaskStatus.STATUS_21_BLOCKED,
      ];

      for (const status of validStatuses) {
        const dto = plainToInstance(CreateTaskDto, {
          caseId: '123e4567-e89b-12d3-a456-426614174000',
          assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
          status,
          name: 'Test Task',
          description: 'Test description',
        });

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid status value', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'INVALID_STATUS' as any,
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should accept missing status (optional)', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('name validation', () => {
    it('should accept valid string for name', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Valid Task Name',
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long string for name', async () => {
      const longName = 'A'.repeat(1000);
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: longName,
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string name', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 12345 as any,
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should reject missing name', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        description: 'Test description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('description validation', () => {
    it('should accept valid string for description', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 'Valid task description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long string for description', async () => {
      const longDescription = 'A'.repeat(5000);
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: longDescription,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string description', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
        description: 12345 as any,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should reject missing description', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'Test Task',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('complete DTO validation', () => {
    it('should pass validation with all valid fields', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_10_ASSIGNED,
        name: 'Complete Task',
        description: 'Complete task description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with multiple invalid fields', async () => {
      const dto = plainToInstance(CreateTaskDto, {
        caseId: 'invalid-uuid',
        assignedUserId: 'invalid-uuid',
        status: 'INVALID_STATUS' as any,
        name: 12345 as any,
        description: 67890 as any,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(5);

      const errorProperties = errors.map((error) => error.property);
      expect(errorProperties).toContain('caseId');
      expect(errorProperties).toContain('assignedUserId');
      expect(errorProperties).toContain('status');
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('description');
    });

    it('should fail validation with completely empty object', async () => {
      const dto = plainToInstance(CreateTaskDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(3); // status is optional, so only 4 errors

      const errorProperties = errors.map((error) => error.property);
      expect(errorProperties).toContain('caseId');
      expect(errorProperties).not.toContain('assignedUserId'); // optional
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('description');
      expect(errorProperties).not.toContain('status'); // status is optional
    });
  });
});
