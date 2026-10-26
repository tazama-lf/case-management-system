import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateTaskDto } from './dto/create-task.dto';
import { Outcome } from '../../utils/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma, CaseStatus } from '@prisma/client-cms';
import { TaskAssignedEvent } from '../events/domain-events';
import { TaskRepository } from '../repository/task.repository';
import { FlowableService } from '../flowable/flowable.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { CaseInvestigatorService, SyncTaskAssignmentParams } from '../case-investigator/case-investigator.service';
import { syncCaseAcl } from './utils/sync-case-acl';
import { isInvestigateTask } from '../case-investigator/restricted-view.util';
import { setTimeout } from 'node:timers/promises';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly logger: LoggerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly caseInvestigatorService: CaseInvestigatorService,
  ) {}
  private async syncCaseAcl(caseId: number, tenantId: string, actingUserId: string, params: SyncTaskAssignmentParams): Promise<void> {
    await syncCaseAcl(this.caseInvestigatorService, this.logger, TaskService.name, caseId, tenantId, actingUserId, params);
  }

  async createTask(taskDTO: CreateTaskDto, userId: string, tenantId: string, tx?: Prisma.TransactionClient): Promise<Task> {
    this.logger.log('Start - createTask', TaskService.name);
    try {
      const caseRecord = tx
        ? await this.taskRepository.findCaseBasic(taskDTO.caseId, tenantId, tx)
        : await this.taskRepository.findCaseBasic(taskDTO.caseId, tenantId);
      if (!caseRecord) {
        throw new NotFoundException(`Case ${taskDTO.caseId} not found`);
      }

      const createdTask = await this.taskRepository.createTask(
        {
          case: {
            connect: {
              case_id: taskDTO.caseId,
            },
          },
          tenant_id: caseRecord.tenant_id,
          name: taskDTO.name,
          description: taskDTO.description,
          candidateGroup: taskDTO.candidateGroup,
          status: taskDTO.status,
          assigned_user_id: taskDTO.assignedUserId,
          investigationNotes: taskDTO.investigationNotes,
        },
        tx,
      );

      if (createdTask === null) {
        throw new Error('Failed to create task');
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
          entityName: TaskService.name,
          operation: 'createTask',
          outcome: Outcome.SUCCESS,
          tenantId: caseRecord.tenant_id,
        },
        createdTask.case_id,
        caseRecord.tenant_id,
        createdTask.task_id,
      );

      return createdTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating task: ${errorMessage}`, errorStack, TaskService.name);
      this.loggingOrchestrationService.logActions({
        userId,
        actionPerformed: `Error creating task with candidateGroup: ${taskDTO.candidateGroup} - ${errorMessage}`,
        entityName: TaskService.name,
        operation: 'createTask',
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw error;
    }
  }

  async updateTask(taskId: number, updateData: Partial<UpdateTaskDto>, userId: string, tenantId: string): Promise<Task> {
    this.logger.log(`Start - Update Task: ${taskId}`, TaskService.name);
    try {
      const txResult = await this.taskRepository.transaction(async (tx) => {
        let updatedTask: Task;
        let caseStatusNotification: { caseId: number; newStatus: CaseStatus } | undefined;
        const existingTask = await this.taskRepository.findTaskWithCase(taskId, tenantId, tx);
        if (existingTask === null || existingTask.case === null) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }

        let investigationNote: string | undefined;
        if (updateData.investigationNotes !== undefined && existingTask.investigationNotes !== null) {
          investigationNote = `${existingTask.investigationNotes}\n\n Completion Notes: ${updateData.investigationNotes}`;
        } else {
          investigationNote = updateData.investigationNotes;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above: ?? would misbehave on an explicit null
        const nextAssignedUserId = updateData.assignedUserId === undefined ? existingTask.assigned_user_id : updateData.assignedUserId;

        // this is the one place a task mutation
        // must actually be BLOCKED by the ACL, not just synced after the
        // fact — a blocklisted user must not be able to get back onto a
        // case merely by being (re)assigned a task on it. Checked here,
        // before any write, so it aborts the transaction with nothing to
        // roll back yet. Only checked on a genuine assignment change (a
        // no-op resend of the same assignee, or the field being omitted
        // entirely, has nothing to check against).
        if (nextAssignedUserId && nextAssignedUserId !== existingTask.assigned_user_id) {
          const blocked = await this.caseInvestigatorService.isBlocklisted(existingTask.case_id, nextAssignedUserId, tenantId);
          if (blocked) {
            throw new ForbiddenException(await this.caseInvestigatorService.formatBlockedMessage(blocked));
          }
        }

        // A task can't be started with nobody holding it: promoteCaseToInProgress would otherwise
        // move the case to IN_PROGRESS while leaving case_owner_user_id null.
        if (updateData.status === TaskStatus.STATUS_20_IN_PROGRESS && !nextAssignedUserId) {
          throw new BadRequestException('A task must be assigned before it can be set to In Progress');
        }

        const updateInput: Prisma.TaskUpdateInput = {
          status: updateData.status,
          assigned_user_id: nextAssignedUserId,
          investigationNotes: investigationNote,
        };

        const shouldPromoteCaseToInProgress = this.shouldPromoteCaseToInProgress(existingTask, updateData);
        const isCaseEligibleForInProgress = this.isCaseEligibleForInProgress(existingTask.case.status);
        if (shouldPromoteCaseToInProgress && isCaseEligibleForInProgress) {
          ({ task: updatedTask, caseStatusNotification } = await this.promoteCaseToInProgress(
            taskId,
            updateInput,
            existingTask,
            tenantId,
            userId,
            tx,
          ));
        } else {
          updatedTask = await this.taskRepository.updateTask(taskId, updateInput, tx);

          const assigneeChanged = existingTask.assigned_user_id !== nextAssignedUserId;

          // Covers both reassignment to someone else AND an explicit unassign (nextAssignedUserId
          // === null) — either way the previous holder is losing the task and Flowable needs to
          // hear about it before anything else happens with this task.
          let unassignedPreviousHolder = false;
          if (assigneeChanged && existingTask.assigned_user_id) {
            await this.flowableService.handleTaskUnassigned({
              taskId,
              caseId: existingTask.case_id,
              taskName: existingTask.name!,
              assignedUser: null,
            });
            unassignedPreviousHolder = true;
          }

          if (nextAssignedUserId) {
            // A new (or unchanged) real assignee — Flowable needs the current claim.
            try {
              await this.executeFlowableOperation(updatedTask, nextAssignedUserId);
            } catch (error) {
              if (unassignedPreviousHolder) {
                // The old claim was just removed from Flowable above, and the DB write this
                // transaction made is about to roll back along with everything else once this
                // error propagates - without putting the old claim back, Flowable would be left
                // with no claim at all on a task the DB still (once rolled back) says is held by
                // existingTask.assigned_user_id.
                try {
                  await this.executeFlowableOperation(existingTask, existingTask.assigned_user_id!);
                } catch (restoreError) {
                  this.logger.error(
                    `Failed to restore previous Flowable claim for task ${taskId} after a failed reassignment`,
                    restoreError,
                    TaskService.name,
                  );
                }
              }
              throw error;
            }
          } else if (!assigneeChanged) {
            // Status/notes-only update to a task with no assignee, before or after. There's no
            // real assignee to report, but this status transition still needs Flowable to record
            // a claim, so fall back to whoever made this call rather than passing null.
            await this.executeFlowableOperation(updatedTask, userId);
          }
          // else: assigneeChanged && !nextAssignedUserId - an explicit unassign. handleTaskUnassigned
          // above already told Flowable; the previous holder must not be reclaimed for, so there is
          // nothing left to pass to executeFlowableOperation.
        }

        if (existingTask.status === updatedTask.status) {
          await this.loggingOrchestrationService.logActions({
            userId,
            actionPerformed: `Updated task ${taskId}`,
            entityName: TaskService.name,
            operation: 'updateTask',
            outcome: Outcome.SUCCESS,
            tenantId: updatedTask.tenant_id,
          });
        } else {
          await this.loggingOrchestrationService.logActionsWithHistory(
            {
              userId,
              actionPerformed: `Updated task ${taskId} from ${existingTask.status} to ${updatedTask.status}`,
              entityName: TaskService.name,
              operation: 'updateTask',
              outcome: Outcome.SUCCESS,
              tenantId: updatedTask.tenant_id,
            },
            updatedTask.case_id,
            updatedTask.tenant_id,
            updatedTask.task_id,
          );
        }

        return { updatedTask, previousAssigneeId: existingTask.assigned_user_id, caseStatusNotification };
      });

      await this.syncCaseAcl(txResult.updatedTask.case_id, tenantId, userId, {
        taskId,
        previousAssigneeId: txResult.previousAssigneeId,
        newAssigneeId: txResult.updatedTask.assigned_user_id,
        newStatus: txResult.updatedTask.status,
      });
      if (txResult.caseStatusNotification) {
        try {
          await this.flowableService.handleCaseStatusChanged(txResult.caseStatusNotification);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.warn(
            `Case status change notification/Flowable sync failed for case ${txResult.caseStatusNotification.caseId} (continuing): ${errorMessage}`,
            errorStack,
            TaskService.name,
          );
        }
      }

      this.logger.log('End - updateTask', TaskService.name);
      return txResult.updatedTask;
    } catch (error) {
      this.logger.error(`Error updating task ${taskId}`, error, TaskService.name);
      await this.loggingOrchestrationService.logActions({
        userId,
        actionPerformed: `Error updating task ${taskId}: ${JSON.stringify(updateData)}`,
        entityName: TaskService.name,
        operation: 'updateTask',
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw error;
    }
  }

  async getTasksByCaseId(caseId: number, tenantId: string, userId?: string, userClaims: string[] = []): Promise<Task[]> {
    this.logger.log('Retrieving tasks by case', TaskService.name);

    try {
      const tasks = await this.taskRepository.findTasks({ case_id: caseId }, tenantId, true);
      const enrichedTasks = tasks.map((task) => {
        const assignedUser: string | null = task.assigned_user_id;
        return {
          ...task,
          assignedUser,
        };
      });

      if (userId) {
        await this.loggingOrchestrationService.logActions({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Successfully retrieved tasks for case: ${caseId}`,
          outcome: Outcome.SUCCESS,
          tenantId,
        });
      }

      return enrichedTasks;
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      if (userId) {
        await this.loggingOrchestrationService.logActions({
          userId,
          operation: 'getTasksByCaseId',
          entityName: TaskService.name,
          actionPerformed: `Error retrieving tasks for case: ${caseId}`,
          outcome: Outcome.FAILURE,
          tenantId,
        });
      }
      throw error;
    }
  }

  async getTasks(tenantId: string, userId: string, role: string, status?: string): Promise<Task[]> {
    try {
      // Tenant-wide list: without this, an investigator could list tasks (and their case
      // summary) for cases that GET /task/case/:caseId would 404 for them.
      const caseIds = await this.caseInvestigatorService.getCaseIdScope(userId, tenantId, role);
      const where = {
        ...(status ? { status: status as TaskStatus } : {}),
        ...(caseIds ? { case_id: { in: caseIds } } : {}),
      };
      return await this.taskRepository.findTasks(where, tenantId, true);
    } catch (error) {
      this.logger.error('Error retrieving tasks', error, TaskService.name);
      throw error;
    }
  }

  /**
   * Write-side counterpart of the read gate, for the task mutation endpoints
   * (reassign/unassign/complete/PATCH). Called from the controller, not
   * from updateTask itself, because updateTask also has internal callers (draft
   * abandon/complete, triage, closure) that run on cases with no allowlist rows.
   *
   * Passes if the caller is the task's current assignee (a task's holder can always
   * act on it), OR is claiming: `newAssigneeId` is the caller and the task is
   * currently unassigned (claiming has to stay open - it's how an investigator
   * first gets onto a case). Otherwise the caller needs case access (supervisor/
   * compliance bypass, or a live allowlist row) just to be considered - a caller
   * with no access gets the usual NotFound. If the task is still unassigned, case
   * access alone is enough (e.g. assigning it to someone else). If it's already
   * held by someone else, only a supervisor/compliance officer may act on it too -
   * any other case member (e.g. a past OBSERVER, or a peer holding a different
   * task on the same case) is rejected; mere case visibility isn't the same as
   * being allowed to mutate someone else's active task. A missing task is left
   * for the caller's own NotFound.
   */
  async assertCanMutateTask(taskId: number, tenantId: string, userId: string, role: string, newAssigneeId?: string | null): Promise<void> {
    const task = await this.taskRepository.findTaskById(taskId, tenantId);
    if (!task) return;
    const blocked = await this.caseInvestigatorService.isBlocklisted(task.case_id, userId, tenantId);
    if (blocked) {
      throw new ForbiddenException(await this.caseInvestigatorService.formatBlockedMessage(blocked));
    }
    if (task.assigned_user_id === userId) return;

    // Case visibility comes first: a user with no access at all (NONE) gets the usual 404 before anything
    // below, so claiming an unassigned task can never be what grants them the case (assignment adds them).
    const level = await this.caseInvestigatorService.assertViewAccess(task.case_id, userId, tenantId, role);

    // A revoked (RESTRICTED) investigator may still re-claim an unassigned task for themselves - being
    // assigned again is how their access returns.
    if (!task.assigned_user_id && newAssigneeId === userId) return;

    // Someone who was revoked from the case can still see it, but not act on a task they don't hold: say so
    // plainly (403) instead of the "case not found" a person with no access at all gets (404).
    if (level === 'RESTRICTED') {
      throw new ForbiddenException('Your access to this case was revoked - you can view it but not change its tasks.');
    }

    if (task.assigned_user_id && role !== 'CMS_SUPERVISOR' && role !== 'CMS_COMPLIANCE_OFFICER') {
      throw new ForbiddenException('This task is held by another investigator - only its current holder or a supervisor can mutate it.');
    }
  }

  async getTaskById(taskId: number, tenantId: string, userId: string, role: string): Promise<Task | null> {
    try {
      const task = await this.taskRepository.findTaskWithCase(taskId, tenantId);
      if (task) {
        const level = await this.caseInvestigatorService.assertViewAccess(task.case_id, userId, tenantId, role);
        if (level === 'RESTRICTED' && isInvestigateTask(task.name)) {
          throw new ForbiddenException('Your access to this case was revoked - the Investigate Case task is no longer available to you.');
        }
      }
      return task;
    } catch (error) {
      this.logger.error(`Error retrieving task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async claimTask(taskId: number, userId: string, tenantId: string): Promise<Task> {
    this.logger.log(`User ${userId} claiming task ${taskId}`, TaskService.name);

    try {
      const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
      if (!existingTask) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const previousAssignedUserId = existingTask.assigned_user_id;

      // block the claim if the claimant is
      // blocklisted on this case, before writing anything.
      const blocked = await this.caseInvestigatorService.isBlocklisted(existingTask.case_id, userId, tenantId);
      if (blocked) {
        throw new ForbiddenException(await this.caseInvestigatorService.formatBlockedMessage(blocked));
      }

      const updatedTask = await this.taskRepository.updateTask(taskId, {
        assigned_user_id: userId,
        status: TaskStatus.STATUS_10_ASSIGNED,
      });

      await this.syncCaseAcl(updatedTask.case_id, tenantId, userId, {
        taskId,
        previousAssigneeId: previousAssignedUserId,
        newAssigneeId: userId,
        newStatus: updatedTask.status,
      });

      this.eventEmitter.emit(
        'task.assigned',
        new TaskAssignedEvent(taskId, updatedTask.case_id, userId, previousAssignedUserId ?? undefined),
      );

      this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          actionPerformed: `Claimed task ${taskId}`,
          entityName: TaskService.name,
          operation: 'claimTask',
          outcome: Outcome.SUCCESS,
          tenantId: updatedTask.tenant_id,
        },
        updatedTask.case_id,
        updatedTask.tenant_id,
        taskId,
      );

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error claiming task ${taskId}`, error, TaskService.name);
      throw error;
    }
  }

  async getUserTasks(userId: string, tenantId: string, includeCompleted = false): Promise<Task[]> {
    try {
      const statusFilter = includeCompleted
        ? {}
        : {
            status: {
              not: TaskStatus.STATUS_30_COMPLETED,
            },
          };

      return await this.taskRepository.findTasks({ assigned_user_id: userId, ...statusFilter }, tenantId, true);
    } catch (error) {
      this.logger.error(`Error retrieving tasks for user ${userId}`, error, TaskService.name);
      throw error;
    }
  }

  private shouldPromoteCaseToInProgress(task: Task, updateData: Partial<UpdateTaskDto>): boolean {
    const isStatusChangeToInProgress =
      updateData.status === TaskStatus.STATUS_20_IN_PROGRESS && task.status !== TaskStatus.STATUS_20_IN_PROGRESS;
    const isInvestigationTask = task.name === 'Investigate Case';
    return isStatusChangeToInProgress && isInvestigationTask;
  }

  private async promoteCaseToInProgress(
    taskId: number,
    updateInput: Prisma.TaskUpdateInput,
    existingTask: Task,
    tenantId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ task: Task; caseStatusNotification: { caseId: number; newStatus: CaseStatus } }> {
    try {
      const taskRecord = await this.taskRepository.updateTask(taskId, updateInput, tx);
      const caseRecord = await this.taskRepository.findCaseStatus(taskRecord.case_id, tenantId, tx);

      const assigneeId = taskRecord.assigned_user_id ?? existingTask.assigned_user_id ?? null;
      const caseUpdateData: Prisma.CaseUpdateInput = { status: CaseStatus.STATUS_20_IN_PROGRESS };
      if (assigneeId && caseRecord!.case_owner_user_id !== assigneeId) caseUpdateData.case_owner_user_id = assigneeId;
      await this.taskRepository.updateCase(taskRecord.case_id, caseUpdateData, tx);

      const assigneeChanged = existingTask.assigned_user_id !== taskRecord.assigned_user_id;

      // Same rule as the non-promotion branch above: covers both reassignment to someone else
      // and an explicit unassign landing alongside this promotion.
      if (assigneeChanged && existingTask.assigned_user_id) {
        await this.flowableService.handleTaskUnassigned({
          taskId,
          caseId: existingTask.case_id,
          taskName: existingTask.name!,
          assignedUser: null,
        });
      }

      if (taskRecord.assigned_user_id) {
        await this.executeFlowableOperation(taskRecord, taskRecord.assigned_user_id);
      } else if (!assigneeChanged) {
        // Status-only promotion of a task that has never had an assignee - fall back to the
        // caller rather than passing null (previously ended up reclaiming for a stale holder,
        // or passing null outright, whenever this task had no real assignee).
        await this.executeFlowableOperation(taskRecord, userId);
      }

      // Notify the Cases Dashboard (via CaseEventsGateway's @OnEvent listener) that this case's
      // status changed - this promotion path updates the case directly and otherwise never
      // calls FlowableService for the case itself (only for the task, above), so without this
      // the dashboard would never learn about it until a manual refresh.
      // Deliberately NOT sent here: this method still runs inside the same DB transaction as the
      // task/case update, and the caller (updateTask) does further work in that same transaction
      // after this returns. Firing the notification now would tell the dashboard about a change
      // that could still be rolled back by something later in the same transaction. The caller
      // sends it only after the transaction has committed - see updateTask.
      return {
        task: taskRecord,
        caseStatusNotification: { caseId: taskRecord.case_id, newStatus: CaseStatus.STATUS_20_IN_PROGRESS },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error promoting case to in progress for task ${taskId}: ${errorMessage}`, errorStack, TaskService.name);
      throw error;
    }
  }

  private isCaseEligibleForInProgress(status: CaseStatus): boolean {
    const eligibleStatuses: CaseStatus[] = [
      CaseStatus.STATUS_10_ASSIGNED,
      CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      CaseStatus.STATUS_03_RETURNED,
    ];

    return eligibleStatuses.includes(status);
  }

  async executeFlowableOperation(updatedTask: Task, assignedUserId: string): Promise<void> {
    const flowableOperation = async (): Promise<void> => {
      await this.flowableService.handleTaskAssigned({
        taskId: updatedTask.task_id,
        caseId: updatedTask.case_id,
        assignedUserId,
        taskName: updatedTask.name!,
      });
    };

    await this.retry(flowableOperation, 5);
  }

  private async retry(fn: () => Promise<void>, maxRetries: number, attempt = 1): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (attempt >= maxRetries) throw error;

      await setTimeout(1000 * attempt);
      await this.retry(fn, maxRetries, attempt + 1);
    }
  }
}
