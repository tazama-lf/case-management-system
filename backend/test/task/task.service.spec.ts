import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../../src/task/task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';

describe('TaskService', () => {
  let service: TaskService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockTask = {
    task_id: 'test-task-1',
    task_title: 'Test Task',
    task_description: 'Test task description',
    task_status: 'PENDING',
    task_priority: 'MEDIUM',
    created_at: new Date(),
    updated_at: new Date(),
    task_assignee: 'test-user',
    task_created_by: 'test-creator',
    case_id: 'test-case-1',
  };

  beforeEach(async () => {
    mockPrismaService = {
      task: {
        findMany: jest.fn().mockResolvedValue([mockTask]),
        findUnique: jest.fn().mockResolvedValue(mockTask),
        create: jest.fn().mockResolvedValue(mockTask),
        update: jest.fn().mockResolvedValue(mockTask),
        delete: jest.fn().mockResolvedValue(mockTask),
      },
    } as any;

    mockAuditLogService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tasks', async () => {
      const result = await service.findAll();

      expect(result).toEqual([mockTask]);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPrismaService.task.findMany.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const result = await service.findOne('test-task-1');

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { task_id: 'test-task-1' },
      });
    });

    it('should return null for non-existent task', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createTaskDto = {
        task_title: 'New Task',
        task_description: 'New task description',
        task_priority: 'HIGH' as any,
        case_id: 'test-case-1',
      };

      const result = await service.create(createTaskDto, 'test-user');

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          task_title: createTaskDto.task_title,
          task_description: createTaskDto.task_description,
          task_priority: createTaskDto.task_priority,
          case_id: createTaskDto.case_id,
          task_created_by: 'test-user',
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const updateTaskDto = {
        task_title: 'Updated Task',
        task_description: 'Updated description',
        task_status: 'IN_PROGRESS' as any,
      };

      const result = await service.update('test-task-1', updateTaskDto, 'test-user');

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: 'test-task-1' },
        data: expect.objectContaining({
          task_title: updateTaskDto.task_title,
          task_description: updateTaskDto.task_description,
          task_status: updateTaskDto.task_status,
          task_last_updated_by: 'test-user',
        }),
      });
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      const result = await service.remove('test-task-1', 'test-user');

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { task_id: 'test-task-1' },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        'test-user',
        'DELETE_TASK',
        'Task',
        'test-task-1'
      );
    });
  });
});
