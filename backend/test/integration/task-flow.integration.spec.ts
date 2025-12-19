import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TaskController } from '../../src/modules/task/task.controller';
import { TaskService } from '../../src/modules/task/task.service';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Task Business Flow (Integration)', () => {
  let app: INestApplication;
  let taskController: TaskController;
  let taskService: TaskService;
  let auditLogService: AuditLogService;
  let prisma: any;

  const mockPrismaService = {
    task: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        TaskService,
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    taskController = moduleFixture.get<TaskController>(TaskController);
    taskService = moduleFixture.get<TaskService>(TaskService);
    auditLogService = moduleFixture.get<AuditLogService>(AuditLogService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a task and log audit action', async () => {
    // Arrange
    const createTaskDto = {
      caseId: 'case-1',
      name: 'Test Task',
      description: 'Integration test',
      // assignedUserId: undefined, // omit or set to undefined if not assigned
    };
    const userId = 'user-123';
    const mockTask = { task_id: 'task-1', ...createTaskDto, status: 'NEW' };
    const mockAuditLog = {
      audit_log_id: 'log-1',
      user_id: userId,
      operation: 'create',
      entity_name: 'Task',
      action_performed: 'Created task',
      outcome: 'success',
      performed_at: new Date(),
    };

    prisma.task.create.mockResolvedValue(mockTask);
    prisma.auditLog.create.mockResolvedValue(mockAuditLog);

    // Act
    const createdTask = await taskService.createTask(createTaskDto, userId, auditLogService);

    // Assert
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: { ...createTaskDto, status: 'NEW' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: userId,
        operation: 'create',
        entity_name: 'Task',
        action_performed: 'Created task',
        outcome: 'success',
      }),
    });
    expect(createdTask).toEqual(mockTask);
  });

  it('should assign a task and log audit action', async () => {
    // Arrange
    const taskId = 'task-1';
    const investigatorId = 'user-456';
    const assignedByUserId = 'user-123';
    const mockAssignedTask = { task_id: taskId, assigned_user_id: investigatorId, status: 'ASSIGNED' };
    const mockAuditLog = {
      audit_log_id: 'log-2',
      user_id: assignedByUserId,
      operation: 'assign',
      entity_name: 'Task',
      action_performed: `Assigned task ${taskId} to investigator ${investigatorId}`,
      outcome: 'success',
      performed_at: new Date(),
    };

    prisma.task.update.mockResolvedValue(mockAssignedTask);
    prisma.auditLog.create.mockResolvedValue(mockAuditLog);

    // Act
    const assignedTask = await taskService.reassignTask(taskId, investigatorId, assignedByUserId, auditLogService);

    // Assert
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { task_id: taskId },
      data: { assigned_user_id: investigatorId, status: 'ASSIGNED' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: assignedByUserId,
        operation: 'assign',
        entity_name: 'Task',
        action_performed: `Assigned task ${taskId} to investigator ${investigatorId}`,
        outcome: 'success',
      }),
    });
    expect(assignedTask).toEqual(mockAssignedTask);
  });

  it('should update a task and log audit action', async () => {
    // Arrange
    const taskId = 'task-1';
    const updateDto = { name: 'Updated Task', description: 'Updated description' };
    const userId = 'user-123';
    const mockUpdatedTask = { task_id: taskId, ...updateDto, assigned_user_id: 'user-456', status: 'UPDATED' };
    const mockAuditLog = {
      audit_log_id: 'log-3',
      user_id: userId,
      operation: 'update',
      entity_name: 'Task',
      action_performed: `Updated task ${taskId}`,
      outcome: 'success',
      performed_at: new Date(),
    };

    prisma.task.update.mockResolvedValue(mockUpdatedTask);
    prisma.auditLog.create.mockResolvedValue(mockAuditLog);

    // Act
    const updatedTask = await taskService.updateTask(taskId, updateDto, userId, auditLogService);

    // Assert
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { task_id: taskId },
      data: updateDto,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: userId,
        operation: 'update',
        entity_name: 'Task',
        action_performed: `Updated task ${taskId}`,
        outcome: 'success',
      }),
    });
    expect(updatedTask).toEqual(mockUpdatedTask);
  });

  it('should log permission denied', async () => {
    // Arrange
    const user = { sub: 'user-999' };
    const mockAuditLog = {
      audit_log_id: 'log-4',
      user_id: 'user-999',
      operation: 'permission_denied', // <-- use underscore if that's your implementation
      entity_name: 'Task',
      action_performed: 'Permission denied',
      outcome: 'denied', // <-- use 'denied' if that's your implementation
      performed_at: new Date(),
    };

    prisma.auditLog.create.mockResolvedValue(mockAuditLog);

    // Act
    await auditLogService.logPermissionDenied(user, 'Task', 'Permission denied');

    // Assert
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-999',
        operation: 'permission_denied',
        entity_name: 'Task',
        action_performed: 'Permission denied',
        outcome: 'denied',
      }),
    });
  });
});
