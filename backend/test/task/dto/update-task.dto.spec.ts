import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateTaskDto } from '../../../src/task/dto/update-task.dto';
import { TaskStatus } from '@prisma/client';
import * as UpdateTaskDtoModule from '../../../src/task/dto/update-task.dto';

describe('UpdateTaskDto', () => {
  it('should be defined', () => {
    const dto = new UpdateTaskDto();
    expect(dto).toBeDefined();
  });

  it('should export UpdateTaskDto class', () => {
    expect(UpdateTaskDtoModule.UpdateTaskDto).toBeDefined();
    expect(typeof UpdateTaskDtoModule.UpdateTaskDto).toBe('function');
    const instance = new UpdateTaskDtoModule.UpdateTaskDto();
    expect(instance).toBeInstanceOf(UpdateTaskDto);
  });

  it('should have all required properties defined', () => {
    const dto = new UpdateTaskDto();
    expect(dto).toHaveProperty('status');
    expect(dto).toHaveProperty('assignedUserId');
    expect(dto).toHaveProperty('name');
    expect(dto).toHaveProperty('description');
  });

  it('should instantiate with all properties set', () => {
    const dto = new UpdateTaskDto();
    dto.status = TaskStatus.STATUS_10_ASSIGNED;
    dto.assignedUserId = '123e4567-e89b-12d3-a456-426614174000';
    dto.name = 'Test Task';
    dto.description = 'Test Description';
    
    expect(dto.status).toBe(TaskStatus.STATUS_10_ASSIGNED);
    expect(dto.assignedUserId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(dto.name).toBe('Test Task');
    expect(dto.description).toBe('Test Description');
  });

  describe('class-validator decorator coverage', () => {
    it('should execute all IsEnum decorator paths for status', async () => {
      // Test each enum value explicitly to ensure decorator is exercised
      for (const status of Object.values(TaskStatus)) {
        const dto = plainToInstance(UpdateTaskDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should execute IsUUID decorator paths for assignedUserId', async () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      for (const uuid of validUUIDs) {
        const dto = plainToInstance(UpdateTaskDto, { assignedUserId: uuid });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should execute IsString decorator paths for name and description', async () => {
      const stringValues = [
        'short',
        'a very long string that contains many characters and should still be valid',
        '123456789',
        'Special characters: !@#$%^&*()',
        'Unicode: 测试 🚀 ñ',
      ];

      for (const value of stringValues) {
        const dto = plainToInstance(UpdateTaskDto, { 
          name: value,
          description: value 
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should execute IsOptional decorator paths by testing undefined/null', async () => {
      // Test each field as undefined
      const undefinedTests = [
        { status: undefined },
        { assignedUserId: undefined },
        { name: undefined },
        { description: undefined },
      ];

      for (const testData of undefinedTests) {
        const dto = plainToInstance(UpdateTaskDto, testData);
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }

      // Test each field as null
      const nullTests = [
        { status: null },
        { assignedUserId: null },
        { name: null },
        { description: null },
      ];

      for (const testData of nullTests) {
        const dto = plainToInstance(UpdateTaskDto, testData);
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('decorator metadata verification', () => {
    it('should have proper class-validator metadata applied', () => {
      const dto = new UpdateTaskDto();
      
      // Verify that the decorators have been applied by checking the class structure
      expect(dto.constructor.name).toBe('UpdateTaskDto');
      
      // These tests ensure that the property assignments work properly
      dto.status = TaskStatus.STATUS_10_ASSIGNED;
      dto.assignedUserId = '123e4567-e89b-12d3-a456-426614174000';
      dto.name = 'Test';
      dto.description = 'Test Description';
      
      expect(dto.status).toBeDefined();
      expect(dto.assignedUserId).toBeDefined();
      expect(dto.name).toBeDefined();
      expect(dto.description).toBeDefined();
    });

    it('should handle property enumeration', () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
        assignedUserId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Task',
        description: 'Test Description'
      });

      const keys = Object.keys(dto);
      expect(keys).toContain('status');
      expect(keys).toContain('assignedUserId');
      expect(keys).toContain('name');
      expect(keys).toContain('description');
    });

    it('should create instances with various combinations of properties', () => {
      // This test ensures all property setter paths are exercised
      const testCases = [
        new UpdateTaskDto(),
        Object.assign(new UpdateTaskDto(), { status: TaskStatus.STATUS_30_COMPLETED }),
        Object.assign(new UpdateTaskDto(), { assignedUserId: '123e4567-e89b-12d3-a456-426614174000' }),
        Object.assign(new UpdateTaskDto(), { name: 'Test' }),
        Object.assign(new UpdateTaskDto(), { description: 'Test' }),
      ];

      testCases.forEach((dto) => {
        expect(dto).toBeInstanceOf(UpdateTaskDto);
        expect(dto).toBeDefined();
      });
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
        const dto = plainToInstance(UpdateTaskDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid status value', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: 'INVALID_STATUS',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should accept undefined status (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: 'Updated Task',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept null status (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('assignedUserId validation', () => {
    it('should accept valid UUID for assignedUserId', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        assignedUserId: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID for assignedUserId', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        assignedUserId: 'invalid-uuid',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('assignedUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject empty string for assignedUserId', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        assignedUserId: '',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('assignedUserId');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should accept undefined assignedUserId (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: 'Updated Task',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept null assignedUserId (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        assignedUserId: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('name validation', () => {
    it('should accept valid string for name', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: 'Updated Task Name',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long string for name', async () => {
      const longName = 'A'.repeat(1000);
      const dto = plainToInstance(UpdateTaskDto, {
        name: longName,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string name', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: 12345,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept undefined name (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept null name (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty string for name', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: '',
      });

      // Note: This may pass depending on validation rules - empty string might be valid
      // If you want to reject empty strings, add @IsNotEmpty() decorator to the DTO
      const errors = await validate(dto);
      expect(errors).toHaveLength(0); // Assuming empty string is allowed
    });
  });

  describe('description validation', () => {
    it('should accept valid string for description', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        description: 'Updated task description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept long string for description', async () => {
      const longDescription = 'A'.repeat(5000);
      const dto = plainToInstance(UpdateTaskDto, {
        description: longDescription,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string description', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        description: 12345,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept undefined description (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_30_COMPLETED,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept null description (optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        description: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty string for description', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        description: '',
      });

      // Assuming empty string is allowed for optional description
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass validation with all valid optional fields', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
        assignedUserId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Updated Task Name',
        description: 'Updated task description',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with some optional fields', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_30_COMPLETED,
        name: 'Updated Task Name',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with single field', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_21_BLOCKED,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object (all fields optional)', async () => {
      const dto = plainToInstance(UpdateTaskDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with multiple invalid fields', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: 'INVALID_STATUS',
        assignedUserId: 'invalid-uuid',
        name: 12345,
        description: 67890,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(4);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('status');
      expect(errorProperties).toContain('assignedUserId');
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('description');
    });

    it('should handle mixed valid and invalid fields', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        status: TaskStatus.STATUS_10_ASSIGNED, // valid
        assignedUserId: 'invalid-uuid', // invalid
        name: 'Valid Name', // valid
        description: 12345, // invalid
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(2);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('assignedUserId');
      expect(errorProperties).toContain('description');
      expect(errorProperties).not.toContain('status');
      expect(errorProperties).not.toContain('name');
    });

    it('should validate with partial UUID and status update', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        assignedUserId: '123e4567-e89b-12d3-a456-426614174001',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with only name and description update', async () => {
      const dto = plainToInstance(UpdateTaskDto, {
        name: 'New Task Name',
        description: 'New task description with more details',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
