import { CanActivate, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from '../src/modules/task/task.controller';
import { TaskService } from '../src/modules/task/task.service';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import { TazamaAuthGuard } from '../src/guards/tazama-auth.guard';

class AllowAllGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

const TASK_ID = 7;
const USER_ID = 'user-1';
const TENANT = 'tenant-1';
const ROLE = 'CMS_INVESTIGATOR';
const DENIED = new NotFoundException('Case not found or access denied');

const req = {
  user: {
    actorRole: ROLE,
    token: { clientId: USER_ID, tenantId: TENANT },
  },
} as any;

/**
 * The write-side ACL gate lives in the controller (updateTask has internal callers that run on
 * draft cases with no whitelist rows), so what matters here is: each mutation endpoint calls
 * assertCanMutateTask BEFORE touching the write path, and a rejection stops it cold.
 */
describe('TaskController - mutation ACL gate', () => {
  let controller: TaskController;
  let taskService: { assertCanMutateTask: jest.Mock; updateTask: jest.Mock };
  let lifecycle: {
    reassignTask: jest.Mock;
    unassignTask: jest.Mock;
    assignTaskToInvestigator: jest.Mock;
    completeTask: jest.Mock;
  };

  beforeEach(async () => {
    taskService = {
      assertCanMutateTask: jest.fn().mockResolvedValue(undefined),
      updateTask: jest.fn().mockResolvedValue({ task_id: TASK_ID }),
    };
    lifecycle = {
      reassignTask: jest.fn().mockResolvedValue({ task_id: TASK_ID }),
      unassignTask: jest.fn().mockResolvedValue({ task_id: TASK_ID }),
      assignTaskToInvestigator: jest
        .fn()
        .mockResolvedValue({ task_id: TASK_ID, assigned_user_id: 'target', status: 'STATUS_10_ASSIGNED', updated_at: new Date() }),
      completeTask: jest.fn().mockResolvedValue({ task_id: TASK_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLifecycleService, useValue: lifecycle },
        { provide: CaseInvestigatorService, useValue: { assertReadAccess: jest.fn() } },
        { provide: 'AUDIT_LOGGER', useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useClass(AllowAllGuard)
      .compile();

    controller = module.get(TaskController);
  });

  const cases: Array<{
    name: string;
    call: () => Promise<unknown>;
    gateArgs: unknown[];
    write: () => jest.Mock;
  }> = [
    {
      name: 'PATCH /:taskId/reassign',
      call: async () => await controller.reassignTask(TASK_ID, { assignedUserId: 'target', note: 'handover' } as any, req),
      gateArgs: [TASK_ID, TENANT, USER_ID, ROLE, 'target'],
      write: () => lifecycle.reassignTask,
    },
    {
      name: 'PATCH /:taskId/unassign',
      call: async () => await controller.unassignTask(TASK_ID, { reason: 'no longer needed' } as any, req),
      gateArgs: [TASK_ID, TENANT, USER_ID, ROLE],
      write: () => lifecycle.unassignTask,
    },
    {
      name: 'PATCH /:taskId (assignedUserId provided)',
      call: async () => await controller.updateTask(TASK_ID, { assignedUserId: 'target' } as any, req),
      gateArgs: [TASK_ID, TENANT, USER_ID, ROLE, 'target'],
      write: () => taskService.updateTask,
    },
    {
      name: 'PATCH /:taskId (status only)',
      call: async () => await controller.updateTask(TASK_ID, { status: 'STATUS_30_COMPLETED' } as any, req),
      gateArgs: [TASK_ID, TENANT, USER_ID, ROLE, undefined],
      write: () => taskService.updateTask,
    },
    {
      name: 'POST /:taskId/complete',
      call: async () => await controller.completeTask(TASK_ID, req),
      gateArgs: [TASK_ID, TENANT, USER_ID, ROLE],
      write: () => lifecycle.completeTask,
    },
  ];

  it.each(cases)('$name: runs the gate with the caller/role/target, then performs the write', async ({ call, gateArgs, write }) => {
    await call();

    expect(taskService.assertCanMutateTask).toHaveBeenCalledWith(...gateArgs);
    expect(write()).toHaveBeenCalledTimes(1);
    // gate must run before the write
    expect(taskService.assertCanMutateTask.mock.invocationCallOrder[0]).toBeLessThan(write().mock.invocationCallOrder[0]);
  });

  it.each(cases)('$name: a gate rejection propagates and nothing is written', async ({ call, write }) => {
    taskService.assertCanMutateTask.mockRejectedValueOnce(DENIED);

    await expect(call()).rejects.toBe(DENIED);

    expect(write()).not.toHaveBeenCalled();
  });

  it('PATCH /:taskId/assign is deliberately NOT gated (self-assign is a supported flow)', async () => {
    await controller.assignTaskToInvestigator(TASK_ID, { assignedUserId: 'target' } as any, req);

    expect(taskService.assertCanMutateTask).not.toHaveBeenCalled();
    expect(lifecycle.assignTaskToInvestigator).toHaveBeenCalledTimes(1);
  });

  it('propagates a ForbiddenException-style rejection the same way (not swallowed)', async () => {
    const forbidden = new ForbiddenException('nope');
    taskService.assertCanMutateTask.mockRejectedValueOnce(forbidden);

    await expect(controller.completeTask(TASK_ID, req)).rejects.toBe(forbidden);
    expect(lifecycle.completeTask).not.toHaveBeenCalled();
  });
});
