import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { CaseStatus, TaskStatus, CaseCreationType, CaseType } from '@prisma/client-cms';
import { GetUserCasesQueryDto } from './dto/get-user-cases.dto';
import { CasePriorityUtil } from '../shared/utils/case-priority.util';
import { TaskValidationUtil } from '../shared/utils/task-validation.util';
import { GetAllCasesQueryDto } from './dto/get-all-cases.dto';
import { ManualCreateCaseDto } from './dto/manual-case-create.dto';
import { TaskService } from 'src/task/task.service';
import { CreateCommentDto } from 'src/comment/dto/create-comment.dto';
import { CommentService } from 'src/comment/comment.service';
import { CaseCreationService } from '../case-creation/case-creation.service';
import {
  CaseAbandonedEvent,
  CaseStatusChangedEvent,
  TaskCompletedEvent,
  CaseSuspendedEvent,
  CaseResumedEvent,
  TaskStatusChangedEvent,
  TaskCreatedEvent,
} from '../events/domain-events';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import { NotificationService } from '../notification/notification.service';
import { AuthHelperService } from 'src/auth/auth-helper.service';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly taskService: TaskService,
    private readonly commentService: CommentService,
    private readonly caseCreationService: CaseCreationService,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly notificationService: NotificationService,
    private readonly authHelperService: AuthHelperService,
  ) {}

  async createCaseSystemTransmission(payload: SystemCaseCreationDto, clientId: string, tenantId: string) {
    try {
      this.logger.log('System-to-system case creation initiated', CaseService.name);

      this.eventEmitter.emit('alert.incoming', {
        payload,
        source: 'REST API',
        userId: clientId,
        tenantId,
      });

      await this.auditLogService.logAction({
        userId: clientId,
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: 'Case creation triggered via system transmission',
        outcome: Outcome.SUCCESS,
      });
      return { message: 'Case creation triggered via system transmission' };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }
  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    this.logger.log(`[ManualCase] Starting manual case creation by user ${userId} with role ${role}`, CaseService.name);

    const existingAlert = await this.prismaService.alert.findUnique({
      where: { alert_id: dto.alertId },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert ${dto.alertId} not found`);
    }

    if (existingAlert.case_id) {
      throw new BadRequestException(`Case already exists for alertId ${dto.alertId}`);
    }

    if ((existingAlert.alert_data as any)?.status !== 'NALT') {
      throw new BadRequestException('Can only create manual cases from alerts with NALT status');
    }

    const priorityScore = dto.priorityScore;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = (CaseType as Record<string, CaseType>)[dto.alertType];
    
    if (!caseType) {
      throw new BadRequestException('Valid alert type is required: FRAUD, AML, or FRAUD_AND_AML');
    }

    const isSupervisor = role === 'SUPERVISOR';

    const needsApproval = !isSupervisor;
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
    const caseOwnerId = needsApproval ? undefined : userId;

    this.logger.log(
      `[ManualCase] Case will ${needsApproval ? 'require approval' : 'be auto-approved'}, status: ${caseStatus}, role: ${role}`,
      CaseService.name,
    );

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const caseDetail: CreateCaseDto = {
          tenantId,
          caseCreatorUserId: userId,
          caseOwnerUserId: caseOwnerId,
          status: caseStatus,
          caseType,
          priority,
          caseCreationType: CaseCreationType.MANUAL,
        };

        const createdCase = await this.caseCreationService.createCase(caseDetail, userId, role);

        this.logger.log(`[ManualCase] Case ${createdCase.case_id} created via workflow service`, CaseService.name);

        const updatedAlert = await prisma.alert.update({
          where: { alert_id: dto.alertId },
          data: {
            priority,
            alert_type: dto.alertType,
            priority_score: priorityScore,
            case_id: createdCase.case_id,
          },
        });

        this.logger.log(`[ManualCase] Alert ${dto.alertId} linked to case ${createdCase.case_id}`, CaseService.name);

        return { case: createdCase, alert: updatedAlert };
      });

      this.logger.log(
        `[ManualCase] Case ${result.case.case_id} created. BPMN will create ${needsApproval ? 'approval task' : 'investigation task'} automatically.`,
        CaseService.name,
      );

      this.logger.log(`[ManualCase] Manual case creation completed successfully for case ${result.case.case_id}`, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'createManualCase',
        entityName: CaseService.name,
        actionPerformed: `Manual case ${result.case.case_id} created for alert ${dto.alertId} by ${role}${needsApproval ? ' (pending supervisor approval, BPMN will create approval task)' : ' (auto-approved, BPMN will create investigation task)'}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: result.case,
        alert: result.alert,
        message: needsApproval
          ? 'Case created and pending approval. Approval task will be created by workflow engine.'
          : 'Case created and ready for investigation. Investigation task will be created by workflow engine.',
        requiresApproval: needsApproval,
        creatorRole: role,
      };
    } catch (err) {
      this.logger.error('[ManualCase] Manual case creation failed', { error: err, dto, userId, tenantId });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${err.message}`);
    }
  }

  private async validateCaseCreationApprovalPreconditions(caseId: string): Promise<void> {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Creation',
          },
        },
        alert: {
          select: {
            alert_id: true,
            alert_type: true,
          },
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending creation approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
      });
    }

    const missingFields: string[] = [];
    if (!caseData.priority) missingFields.push('priority');
    if (!caseData.case_type) missingFields.push('case_type');
    if (!caseData.case_creator_user_id) missingFields.push('case_creator_user_id');

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Case has missing required fields',
        missingFields,
      });
    }

    const approvalTask = caseData.tasks[0];
    if (!approvalTask) {
      throw new NotFoundException('Approve Case Creation task not found');
    }

    if (approvalTask.status !== TaskStatus.STATUS_01_UNASSIGNED) {
      throw new ConflictException({
        message: 'Approval task is not in correct state',
        currentStatus: approvalTask.status,
        requiredStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });
    }
  }

  async approveCaseCreation(caseId: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`[ApproveCaseCreation] Supervisor ${supervisorId} approving case creation for case ${caseId}`, CaseService.name);

      // First check the case status
      const caseData = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        select: {
          case_id: true,
          status: true,
          case_creator_user_id: true,
          priority: true,
          case_type: true,
        },
      });

      if (!caseData) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      if (caseData.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT) {
        const errorMsg = `Case ${caseId} was already approved (created by supervisor). Current status: ${caseData.status}`;
        this.logger.warn(`[ApproveCaseCreation] ${errorMsg}`, CaseService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseCreation',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

        throw new ConflictException({
          message: 'Case does not require approval - it was already approved when created by a supervisor',
          currentStatus: caseData.status,
          caseId,
          note: 'This case was created by a supervisor and skipped the approval workflow',
        });
      }

      if (caseData.status !== CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL) {
        throw new ConflictException({
          message: 'Case is not pending creation approval',
          currentStatus: caseData.status,
          requiredStatus: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          caseId,
        });
      }

      const missingFields: string[] = [];
      if (!caseData.priority) missingFields.push('priority');
      if (!caseData.case_type) missingFields.push('case_type');
      if (!caseData.case_creator_user_id) missingFields.push('case_creator_user_id');

      if (missingFields.length > 0) {
        throw new BadRequestException({
          message: 'Case has missing required fields',
          missingFields,
        });
      }

      const approvalTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          name: 'Approve Case Creation',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
      });

      if (!approvalTask) {
        const errorMsg = 'Approve Case Creation task not found';
        this.logger.error(`[ApproveCaseCreation] ${errorMsg} for case ${caseId}`, null, CaseService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseCreation',
          entityName: CaseService.name,
          actionPerformed: `${errorMsg} for case ${caseId}`,
          outcome: Outcome.FAILURE,
        });

        throw new NotFoundException(
          `${errorMsg}. The case may have been created by a supervisor and doesn't require approval, or the BPMN workflow has not yet created the task.`,
        );
      }

      if (approvalTask.status !== TaskStatus.STATUS_01_UNASSIGNED) {
        throw new ConflictException({
          message: 'Approval task is not in correct state',
          currentStatus: approvalTask.status,
          requiredStatus: TaskStatus.STATUS_01_UNASSIGNED,
        });
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            updated_at: new Date(),
          },
        });

        const completedApprovalTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        return { case: updatedCase, approvedTask: completedApprovalTask };
      });

      this.eventEmitter.emit(
        'task.status.changed',
        new TaskStatusChangedEvent(
          result.approvedTask.task_id,
          caseId,
          'Approve Case Creation',
          TaskStatus.STATUS_01_UNASSIGNED,
          TaskStatus.STATUS_30_COMPLETED,
          supervisorId,
          {
            creationApproval: 'approve',
            creationComments: 'Case creation approved by supervisor',
          },
        ),
      );

      // Emit case status changed
      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          'Case creation approved by supervisor',
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Approved case creation for case ${caseId}. BPMN will create investigation task.`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `[ApproveCaseCreation] Case creation approved successfully for case ${caseId}. BPMN will create investigation task automatically.`,
        CaseService.name,
      );

      setTimeout(async () => {
        try {
          const investigationTask = await this.prismaService.task.findFirst({
            where: {
              case_id: caseId,
              name: { in: ['Investigate Case', 'Investigate case'] },
              status: TaskStatus.STATUS_01_UNASSIGNED,
            },
          });

          if (investigationTask) {
            this.logger.log(
              `[ApproveCaseCreation] Investigation task ${investigationTask.task_id} created successfully for case ${caseId}`,
              CaseService.name,
            );
          } else {
            this.logger.warn(
              `[ApproveCaseCreation] Investigation task not found after 3 seconds for case ${caseId}. BPMN may still be processing.`,
              CaseService.name,
            );
          }
        } catch (error) {
          this.logger.warn(`[ApproveCaseCreation] Failed to verify investigation task creation: ${error.message}`, CaseService.name);
        }
      }, 3000);

      return {
        success: true,
        case: result.case,
        approvedTask: result.approvedTask,
        message: 'Case creation approved. Investigation task will be created by workflow engine.',
      };
    } catch (error) {
      this.logger.error(`[ApproveCaseCreation] Failed to approve case creation: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async rejectCaseCreation(caseId: string, supervisorId: string, tenantId: string, reason: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case creation for case ${caseId}`, CaseService.name);
      await this.validateCaseCreationApprovalPreconditions(caseId);

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Rejection reason is required and must be at least 10 characters');
      }

      const existingCase = await this.retrieveCase(caseId);

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_00_DRAFT, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve Case Creation', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException('Approve Case Creation task not found');

        await this.taskService.updateTask(
          approvalTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED, assignedUserId: supervisorId },
          supervisorId,
          this.auditLogService,
        );

        return { case: updatedCase, completedTask: approvalTask };
      });

      const completeNewCaseTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          assignedUserId: existingCase.case_creator_user_id,
          name: 'Complete New Case',
          description: 'Revise and complete the case as per supervisor feedback',
          candidateGroup: 'investigations',
        },
        supervisorId,
        this.auditLogService,
        this.logger,
      );

      await this.prismaService.comment.create({
        data: {
          user_id: supervisorId,
          task_id: completeNewCaseTask.task_id,
          note: `Case creation rejected. Reason: ${reason}`,
        },
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          CaseStatus.STATUS_00_DRAFT,
          `Case creation rejected: ${reason}`,
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Rejected case creation for case ${caseId}, created Complete New Case task ${completeNewCaseTask.task_id}. Reason: ${reason}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: completeNewCaseTask };
    } catch (error) {
      this.logger.error(`Failed to reject case creation for case ${caseId}: ${error.message}`, error.stack, CaseService.name);
      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string, role: string) {
    try {
      this.logger.log(`User ${userId} attempting to close case ${caseId}`, CaseService.name);

      const caseData = await this.prismaService.case.findFirst({
        where: {
          case_id: caseId,
          OR: [
            { case_owner_user_id: userId },
            { tasks: { some: { assigned_user_id: userId, name: { in: ['Investigate Case', 'Investigate case', 'investigate case'] } } } },
          ],
        },
        include: {
          tasks: true,
          alert: true,
          comments: true,
        },
      });

      if (!caseData) {
        const errorMsg = `Case ${caseId} not found or you don't have permission to close it`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new NotFoundException(errorMsg);
      }

      if (caseData.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
        const errorMsg = `Case closure failed: Case is not in progress. Current status: ${caseData.status}, Required status: STATUS_20_IN_PROGRESS`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

        throw new ConflictException({
          message: 'Case is not in a closeable state',
          currentStatus: caseData.status,
          requiredStatus: CaseStatus.STATUS_20_IN_PROGRESS,
          caseId,
        });
      }

      const investigationTask = caseData.tasks.find(
        (task) => task.name === 'Investigate Case' || task.name === 'Investigate case' || task.name === 'investigate case',
      );

      if (!investigationTask) {
        const errorMsg = `Case closure failed: Investigation task not found for case ${caseId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Investigation task not found for this case',
          caseId,
          missingTask: 'Investigate Case',
        });
      }

      if (investigationTask.assigned_user_id !== userId) {
        const errorMsg = `Case closure failed: Investigation task ${investigationTask.task_id} is not assigned to user ${userId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Investigation task is not assigned to you',
          caseId,
          taskId: investigationTask.task_id,
          assignedTo: investigationTask.assigned_user_id,
        });
      }

      if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS && investigationTask.status !== TaskStatus.STATUS_30_COMPLETED) {
        const errorMsg = `Case closure failed: Investigation task status is ${investigationTask.status}, required: STATUS_20_IN_PROGRESS or STATUS_30_COMPLETED`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new ConflictException({
          message: 'Investigation task must be in progress or completed to close case',
          currentStatus: investigationTask.status,
          requiredStatuses: [TaskStatus.STATUS_20_IN_PROGRESS, TaskStatus.STATUS_30_COMPLETED],
          taskId: investigationTask.task_id,
        });
      }

      const validationErrors = this.validateClosureData(dto);
      if (validationErrors.length > 0) {
        const errorMsg = `Case closure failed: Missing or invalid information: ${validationErrors.join(', ')}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Missing or invalid case closure information',
          errors: validationErrors,
          caseId,
        });
      }

      const isSupervisor = role === 'CMS_SUPERVISOR';

      // **SUPERVISOR DIRECT CLOSURE PATH**
      if (isSupervisor) {
        this.logger.log(`Supervisor ${userId} is closing case ${caseId} directly without approval`, CaseService.name);

        const finalStatus = dto.recommendedOutcome as CaseStatus;
        const oldTaskStatus = investigationTask.status;

        this.logger.log(
          `[CloseCase-Supervisor] Investigation task ${investigationTask.task_id} current status: ${oldTaskStatus}`,
          CaseService.name,
        );

        const result = await this.prismaService.$transaction(async (tx) => {
          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: finalStatus,
              updated_at: new Date(),
            },
          });

          await tx.task.update({
            where: { task_id: investigationTask.task_id },
            data: {
              status: TaskStatus.STATUS_30_COMPLETED,
              updated_at: new Date(),
            },
          });

          if (dto.finalNotes) {
            await tx.comment.create({
              data: {
                user_id: userId,
                case_id: caseId,
                note: `Supervisor Direct Closure:\n${dto.finalNotes || ''}\n\nFinal Outcome: ${dto.recommendedOutcome}`,
              },
            });
          }

          return { updatedCase };
        });

        if (oldTaskStatus !== TaskStatus.STATUS_30_COMPLETED) {
          this.logger.log(
            `[CloseCase-Supervisor] Emitting task.status.changed event for task ${investigationTask.task_id}: ${oldTaskStatus} -> STATUS_30_COMPLETED`,
            CaseService.name,
          );

          this.eventEmitter.emit(
            'task.status.changed',
            new TaskStatusChangedEvent(
              investigationTask.task_id,
              caseId,
              investigationTask.name || 'Investigate Case',
              oldTaskStatus,
              TaskStatus.STATUS_30_COMPLETED,
              userId,
              {
                investigationAction: 'directClose',
                finalOutcome: dto.recommendedOutcome,
                finalNotes: dto.finalNotes,
                supervisorClosure: true,
              },
            ),
          );
        }

        this.eventEmitter.emit(
          'case.status.changed',
          new CaseStatusChangedEvent(
            caseId,
            CaseStatus.STATUS_20_IN_PROGRESS,
            finalStatus,
            `Case closed directly by supervisor with outcome: ${dto.recommendedOutcome}`,
          ),
        );

        // Auto-generate SAR_STR_FILING task if case is confirmed
        if (finalStatus === CaseStatus.STATUS_82_CLOSED_CONFIRMED) {
          try {
            await this.createSARFilingTask(caseId, tenantId, userId);
            this.logger.log(`Auto-generated SAR_STR_FILING task for confirmed case ${caseId}`, CaseService.name);
          } catch (error) {
            this.logger.error(`Failed to create SAR_STR_FILING task for case ${caseId}: ${error.message}`, error.stack, CaseService.name);
          }
        }

        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: `Supervisor ${userId} closed case ${caseId} directly with outcome: ${dto.recommendedOutcome}`,
          outcome: Outcome.SUCCESS,
        });

        return {
          message: 'Case closed successfully by supervisor',
          closed_case: {
            case_id: result.updatedCase.case_id,
            status: result.updatedCase.status,
            updated_at: result.updatedCase.updated_at,
          },
          supervisor_closure: true,
        };
      }

      const oldTaskStatus = investigationTask.status;

      this.logger.log(`[CloseCase] Investigation task ${investigationTask.task_id} current status: ${oldTaskStatus}`, CaseService.name);

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            updated_at: new Date(),
          },
        });

        await tx.task.update({
          where: { task_id: investigationTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            updated_at: new Date(),
          },
        });

        if (dto.finalNotes) {
          await tx.comment.create({
            data: {
              user_id: userId,
              case_id: caseId,
              note: `Final Investigation Summary:\n${dto.finalNotes || ''}\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
            },
          });
        }

        return { updatedCase };
      });

      this.logger.log(
        `[CloseCase] Emitting task.status.changed event for task ${investigationTask.task_id}: ${oldTaskStatus} -> STATUS_30_COMPLETED`,
        CaseService.name,
      );

      this.eventEmitter.emit(
        'task.status.changed',
        new TaskStatusChangedEvent(
          investigationTask.task_id,
          caseId,
          investigationTask.name || 'Investigate Case',
          oldTaskStatus,
          TaskStatus.STATUS_30_COMPLETED,
          userId,
          {
            investigationAction: 'requestClosure',
            recommendedOutcome: dto.recommendedOutcome,
            finalNotes: dto.finalNotes,
          },
        ),
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_20_IN_PROGRESS,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          `Case closure requested with outcome: ${dto.recommendedOutcome}`,
        ),
      );

      setTimeout(async () => {
        try {
          const tasks = await this.taskService.getTasksByCaseId(caseId);
          const approvalTask = tasks.find(
            (t) => (t.name === 'Approve Case Closure' || t.name === 'Approve case closure') && t.status === TaskStatus.STATUS_01_UNASSIGNED,
          );

          if (approvalTask) {
            this.logger.log(`[CloseCase] Found BPMN-created approval task ${approvalTask.task_id}`, CaseService.name);

            await this.prismaService.comment.create({
              data: {
                user_id: userId,
                task_id: approvalTask.task_id,
                note: JSON.stringify({
                  recommendedOutcome: dto.recommendedOutcome,
                  finalNotes: dto.finalNotes,
                  submittedBy: userId,
                  submittedAt: new Date(),
                }),
              },
            });

            this.logger.log(`[CloseCase] Added closure metadata to approval task ${approvalTask.task_id}`, CaseService.name);

            try {
              await this.notificationService.sendGroupNotification({
                candidateGroup: 'supervisors',
                type: 'CASE_CLOSURE_PENDING',
                message: `Case ${caseId} submitted for closure approval`,
                metadata: {
                  caseId,
                  recommendedOutcome: dto.recommendedOutcome,
                  submittedBy: userId,
                  approvalTaskId: approvalTask.task_id,
                },
              });
            } catch (notificationError) {
              this.logger.warn(`Failed to send supervisor notification: ${notificationError.message}`, CaseService.name);
            }
          } else {
            this.logger.warn(
              `[CloseCase] Approval task not found after 4 seconds. Checking if BPMN process is still running...`,
              CaseService.name,
            );

            this.logger.log(
              `[CloseCase] Current tasks in case ${caseId}: ${tasks.map((t) => `${t.name}(${t.status})`).join(', ')}`,
              CaseService.name,
            );
          }
        } catch (error) {
          this.logger.error(`[CloseCase] Failed to add closure metadata: ${error.message}`, error.stack, CaseService.name);
        }
      }, 4000);

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closed and submitted for approval with outcome: ${dto.recommendedOutcome}. BPMN will create approval task.`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed successfully and submitted for approval. Approval task will be created by workflow engine.',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        approval_task_note: 'Approval task will be created automatically by the workflow engine',
      };
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';

      this.logger.error(`Case closure failed for case ${caseId}: ${errorMessage}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Failed to close case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'System error occurred during case closure',
        caseId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private validateClosureData(dto: CloseCaseDto): string[] {
    const errors: string[] = [];

    if (!dto.recommendedOutcome) {
      errors.push('Recommended outcome is required');
    }

    const validOutcomes = ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'];

    if (dto.recommendedOutcome && !validOutcomes.includes(dto.recommendedOutcome)) {
      errors.push(`Invalid recommended outcome. Must be one of: ${validOutcomes.join(', ')}`);
    }

    if (!dto.finalNotes || dto.finalNotes.trim().length < 5) {
      errors.push('Final notes are required and must be at least 20 characters');
    }

    return errors;
  }

  async suspendCase(caseId: string, reason: string, userId: string, tenantId: string) {
    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can suspend a case');

    if (existingCase.status !== CaseStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException('Only cases in "IN PROGRESS" status can be suspended');

    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for suspension is required');
    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate Case');

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException(`Cannot suspend as Investigate case task ${investigateTask.task_id} is not in progress`);

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_21_SUSPENDED }, userId);

        const updatedTask = await this.taskService.updateTask(
          investigateTask.task_id,
          { status: TaskStatus.STATUS_21_BLOCKED },
          userId,
          this.auditLogService,
        );

        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = `Case suspended: ${reason}`;
        await this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'suspendCase',
          entityName: CaseService.name,
          actionPerformed: `Suspend case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      await new Promise((res) => setTimeout(res, 1000));
      this.eventEmitter.emit('case.suspended', new CaseSuspendedEvent(caseId, reason));

      try {
        const caseAssignee = investigateTask.assigned_user_id;
        if (caseAssignee) {
          const assigneeUserDetail = await this.authHelperService.getUserDetailsFromAuthService(caseAssignee);
          const emailTo = assigneeUserDetail.email;
          const suspendedBy = assigneeUserDetail.username;
          await this.notificationService.sendCaseSuspensionEmail(`${emailTo}`, caseId, suspendedBy, reason);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send suspension notification for case ${caseId}: ${notificationError.message}`);
      }

      return { success: true, ...result };
    } catch (err) {
      await this.auditLogService.logAction({
        userId,
        operation: 'suspendCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to suspend case ${caseId}`,
        outcome: Outcome.FAILURE,
      });

      this.logger.error('suspendCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to suspend case: ${err.message}`);
    }
  }

  async resumeCase(caseId: string, reason: string, userId: string, tenantId: string) {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for resumption is required');

    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can resume a case');

    if (existingCase.status !== CaseStatus.STATUS_21_SUSPENDED) throw new BadRequestException('Only suspended cases can be resumed');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate Case');

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_21_BLOCKED)
      throw new BadRequestException(`Cannot resume as Investigate case task ${investigateTask.task_id} is not blocked`);

    try {
      await this.eventEmitter.emitAsync('case.resumed', new CaseResumedEvent(caseId, reason));

      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_20_IN_PROGRESS }, userId);
        const updatedTask = await this.taskService.updateTask(
          investigateTask.task_id,
          { status: TaskStatus.STATUS_20_IN_PROGRESS },
          userId,
          this.auditLogService,
        );

        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = `Case resumed: ${reason}`;
        await this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'resumeCase',
          entityName: CaseService.name,
          actionPerformed: `Resume case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      try {
        const caseAssignee = investigateTask.assigned_user_id;
        if (caseAssignee) {
          const assigneeUserDetail = await this.authHelperService.getUserDetailsFromAuthService(caseAssignee);
          const emailTo = assigneeUserDetail.email;
          const resumedBy = assigneeUserDetail.username;
          await this.notificationService.sendCaseResumptionEmail(`${emailTo}`, caseId, resumedBy, reason);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send resumption notification for case ${caseId}: ${notificationError.message}`);
      }

      return { success: true, ...result };
    } catch (err) {
      await this.auditLogService.logAction({
        userId,
        operation: 'resumeCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to resume case ${caseId}`,
        outcome: Outcome.FAILURE,
      });

      this.logger.error('resumeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to resume case: ${err.message}`);
    }
  }

  // approve case reopening needs testing
  async approveCaseReopening(caseId: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} approving case reopening for ${caseId}`, CaseService.name);

      const caseData = await this.validateReopeningPreconditions(caseId);

      // Step 2: Find the reopening approval task
      const reopeningTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          name: 'Approve Case Reopening',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
        include: {
          comments: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      let reopeningMetadata: any = {};
      let requesterId: string | null = null;
      let requesterRole: string | null = null;

      if (reopeningTask.comments.length > 0) {
        try {
          const comment = reopeningTask.comments[0];
          const metadata = JSON.parse(comment.note);
          reopeningMetadata = metadata;
          requesterId = metadata.requestedBy;
          requesterRole = metadata.requesterRole;
        } catch (parseError) {
          this.logger.warn(`Failed to parse reopening metadata: ${parseError.message}`, CaseService.name);
        }
      }

      let newCaseStatus: CaseStatus;
      let newTaskStatus: TaskStatus;
      let assignedUserId: string | undefined;
      let candidateGroup: string;

      const isAnalystOrInvestigator =
        requesterRole &&
        (requesterRole.toUpperCase() === 'ANALYST' ||
          requesterRole.toUpperCase() === 'INVESTIGATOR' ||
          requesterRole.toUpperCase() === 'CMS_INVESTIGATOR');

      if (isAnalystOrInvestigator && requesterId) {
        newCaseStatus = CaseStatus.STATUS_10_ASSIGNED;
        newTaskStatus = TaskStatus.STATUS_10_ASSIGNED;
        assignedUserId = requesterId;
        candidateGroup = 'investigations';

        this.logger.log(`Reopening approved - assigning to original requester ${requesterId}`, CaseService.name);
      } else {
        newCaseStatus = CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
        newTaskStatus = TaskStatus.STATUS_01_UNASSIGNED;
        assignedUserId = undefined;
        candidateGroup = 'investigations';

        this.logger.log(
          `Reopening approved - assigning to investigations queue (requester role: ${requesterRole || 'unknown'})`,
          CaseService.name,
        );
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: newCaseStatus,
            case_owner_user_id: assignedUserId || null,
            updated_at: new Date(),
          },
        });

        const completedTask = await tx.task.update({
          where: { task_id: reopeningTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: reopeningTask.task_id,
            note: `Case reopening approved by supervisor. Previous status: ${caseData.status}. Reason: ${reopeningMetadata.reason || 'Not specified'}`,
          },
        });

        return { updatedCase, completedTask };
      });

      const investigationTask = await this.taskService.createTask(
        {
          caseId,
          status: newTaskStatus,
          assignedUserId,
          name: 'Investigate Case',
          description: `Case reopened for additional investigation. ${reopeningMetadata.reason || ''}`,
          candidateGroup,
        },
        supervisorId,
        this.auditLogService,
        this.logger,
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(caseId, CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL, newCaseStatus, 'Case reopening approved'),
      );

      if (assignedUserId) {
        try {
          await this.notificationService.sendNotification({
            userId: assignedUserId,
            type: 'CASE_REOPENED_ASSIGNED',
            message: `Case ${caseId} has been reopened and assigned to you`,
            metadata: {
              caseId,
              taskId: investigationTask.task_id,
              approvedBy: supervisorId,
              reason: reopeningMetadata.reason,
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send analyst notification: ${notificationError.message}`, CaseService.name);
        }
      } else {
        try {
          await this.notificationService.sendGroupNotification({
            candidateGroup,
            type: 'CASE_REOPENED_AVAILABLE',
            message: `Case ${caseId} has been reopened and is available in the work queue`,
            metadata: {
              caseId,
              taskId: investigationTask.task_id,
              approvedBy: supervisorId,
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send group notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} reopening approved. New investigation task ${investigationTask.task_id} created${assignedUserId ? ` and assigned to ${assignedUserId}` : ' in investigations queue'}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} reopening approved. Status: ${newCaseStatus}`, CaseService.name);

      return {
        success: true,
        message: 'Case reopening approved',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          case_owner_user_id: result.updatedCase.case_owner_user_id,
          updated_at: result.updatedCase.updated_at,
        },
        completed_approval_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        investigation_task: {
          task_id: investigationTask.task_id,
          name: investigationTask.name,
          status: investigationTask.status,
          assigned_to: assignedUserId || candidateGroup,
          candidateGroup,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to approve case reopening: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Failed to approve case reopening for ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  // reject case needs testing
  async rejectCaseReopening(caseId: string, rejectionReason: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case reopening for ${caseId}`, CaseService.name);

      if (!rejectionReason || rejectionReason.trim().length < 20) {
        const errorMsg = 'Rejection reason must be at least 20 characters';
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'rejectCaseReopening',
          entityName: CaseService.name,
          actionPerformed: `Failed to reject case reopening for ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException(errorMsg);
      }

      const caseData = await this.validateReopeningPreconditions(caseId);

      const reopeningTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          name: 'Approve Case Reopening',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
        include: {
          comments: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      let requesterId: string | null = null;
      if (reopeningTask.comments.length > 0) {
        try {
          const metadata = JSON.parse(reopeningTask.comments[0].note);
          requesterId = metadata.requestedBy;
        } catch (parseError) {
          this.logger.warn(`Failed to parse reopening metadata: ${parseError.message}`, CaseService.name);
        }
      }

      const originalClosedStatus = this.determineOriginalClosedStatus(caseData);

      const result = await this.prismaService.$transaction(async (tx) => {
        // Restore case to original closed status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: originalClosedStatus,
            updated_at: new Date(),
          },
        });

        const completedTask = await tx.task.update({
          where: { task_id: reopeningTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: reopeningTask.task_id,
            note: `Case reopening rejected by supervisor.\n\nReason: ${rejectionReason}\n\nCase restored to status: ${originalClosedStatus}`,
          },
        });

        return { updatedCase, completedTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
          originalClosedStatus,
          `Case reopening rejected: ${rejectionReason}`,
        ),
      );

      if (requesterId) {
        try {
          await this.notificationService.sendNotification({
            userId: requesterId,
            type: 'CASE_REOPENING_REJECTED',
            message: `Your case reopening request for case ${caseId} was rejected`,
            metadata: {
              caseId,
              rejectionReason,
              rejectedBy: supervisorId,
              restoredStatus: originalClosedStatus,
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send rejection notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} reopening rejected. Case restored to ${originalClosedStatus}. Reason: ${rejectionReason}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} reopening rejected. Restored to ${originalClosedStatus}`, CaseService.name);

      return {
        success: true,
        message: 'Case reopening rejected',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        rejection_reason: rejectionReason,
      };
    } catch (error) {
      this.logger.error(`Failed to reject case reopening: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case reopening for ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  private async validateReopeningPreconditions(caseId: string): Promise<any> {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Reopening',
          },
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending reopening approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        caseId,
      });
    }

    const reopeningTask = caseData.tasks.find((t) => t.name === 'Approve Case Reopening' && t.status === TaskStatus.STATUS_01_UNASSIGNED);

    if (!reopeningTask) {
      throw new NotFoundException(`"Approve Case Reopening" task not found or not in correct state for case ${caseId}`);
    }

    return caseData;
  }

  private determineOriginalClosedStatus(caseData: any): CaseStatus {
    const closedStatuses = [
      CaseStatus.STATUS_81_CLOSED_REFUTED,
      CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
      CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
      CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    ];

    return CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE;
  }

  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string | undefined, supervisorId: string) {
    try {
      this.logger.log(`[ApproveCaseClosure] Supervisor ${supervisorId} attempting to approve case closure for ${caseId}`, CaseService.name);

      const validOutcomes = ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'];

      if (!finalOutcome || !validOutcomes.includes(finalOutcome)) {
        const errorMsg = `Invalid final outcome: ${finalOutcome}. Must be one of: ${validOutcomes.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `Failed to approve case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Invalid final outcome',
          providedOutcome: finalOutcome,
          validOutcomes,
        });
      }

      const caseDetails = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        include: {
          tasks: true,
          alert: true,
          comments: {
            orderBy: { created_at: 'desc' },
            take: 5,
          },
        },
      });

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      this.logger.log(
        `[ApproveCaseClosure] Case status: ${caseDetails.status}, Tasks count: ${caseDetails.tasks.length}`,
        CaseService.name,
      );

      // Log all tasks for debugging
      caseDetails.tasks.forEach((task) => {
        this.logger.log(
          `[ApproveCaseClosure] Task: ${task.name} (${task.task_id}), Status: ${task.status}, Assigned: ${task.assigned_user_id}`,
          CaseService.name,
        );
      });

      if (caseDetails.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
        const errorMsg = `Case is not pending final approval. Current: ${caseDetails.status}, Required: STATUS_22_PENDING_FINAL_APPROVAL`;
        this.logger.warn(`[ApproveCaseClosure] ${errorMsg}`, CaseService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

        throw new ConflictException({
          message: 'Case is not pending final approval',
          currentStatus: caseDetails.status,
          requiredStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          caseId,
        });
      }

      const approvalTask = caseDetails.tasks.find(
        (t) =>
          (t.name === 'Approve Case Closure' || t.name === 'Approve case closure' || t.name === 'approve case closure') &&
          t.status === TaskStatus.STATUS_01_UNASSIGNED,
      );

      if (!approvalTask) {
        const errorMsg = `Approve Case Closure task not found or not in correct state`;
        this.logger.error(
          `[ApproveCaseClosure] ${errorMsg}. Available tasks: ${caseDetails.tasks.map((t) => `${t.name}(${t.status})`).join(', ')}`,
          null,
          CaseService.name,
        );

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `${errorMsg} for case ${caseId}`,
          outcome: Outcome.FAILURE,
        });

        throw new NotFoundException({
          message: `${errorMsg}. The BPMN workflow may not have created the task yet.`,
          availableTasks: caseDetails.tasks.map((t) => ({ name: t.name, status: t.status })),
          caseId,
        });
      }

      this.logger.log(
        `[ApproveCaseClosure] Found approval task ${approvalTask.task_id} with status ${approvalTask.status}`,
        CaseService.name,
      );

      const missingInfo = this.validateCaseCompleteness(caseDetails);
      if (missingInfo.length > 0) {
        const errorMsg = `Case ${caseId} is missing required information: ${missingInfo.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Case has incomplete information',
          missingInformation: missingInfo,
          caseId,
        });
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case to final status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: finalOutcome as CaseStatus,
            updated_at: new Date(),
          },
        });

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        // Add supervisor comments
        if (comments) {
          await tx.comment.create({
            data: {
              user_id: supervisorId,
              task_id: approvalTask.task_id,
              note: `Supervisor Approval:\n${comments}\n\nFinal Outcome: ${finalOutcome}`,
            },
          });
        } else {
          await tx.comment.create({
            data: {
              user_id: supervisorId,
              task_id: approvalTask.task_id,
              note: `Case closure approved with outcome: ${finalOutcome}`,
            },
          });
        }

        return { updatedCase, completedTask };
      });

      // Emit events
      this.eventEmitter.emit(
        'task.status.changed',
        new TaskStatusChangedEvent(
          result.completedTask.task_id,
          caseId,
          approvalTask.name || 'Approve Case Closure',
          TaskStatus.STATUS_01_UNASSIGNED,
          TaskStatus.STATUS_30_COMPLETED,
          supervisorId,
          {
            approvalDecision: 'approve',
            finalOutcome: finalOutcome,
            supervisorComments: comments,
          },
        ),
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          finalOutcome as CaseStatus,
          `Case closure approved with outcome: ${finalOutcome}`,
        ),
      );

      // Auto-generate SAR/STR Filing task if case is confirmed
      if (finalOutcome === 'STATUS_82_CLOSED_CONFIRMED') {
        try {
          await this.createSARFilingTask(caseId, caseDetails.tenant_id, supervisorId);
            this.logger.log(`Auto-generated SAR_STR_FILING task for confirmed case ${caseId}`, CaseService.name);
        } catch (error) {
          this.logger.error(`Failed to create SAR_STR_FILING task for case ${caseId}: ${error.message}`, error.stack, CaseService.name);
        }
      }

      const investigationTask = caseDetails.tasks.find(
        (t) => (t.name === 'Investigate Case' || t.name === 'Investigate case') && t.assigned_user_id,
      );

      if (investigationTask?.assigned_user_id) {
        try {
          await this.notificationService.sendNotification({
            userId: investigationTask.assigned_user_id,
            type: 'CASE_CLOSURE_APPROVED',
            message: `Your case closure for case ${caseId} was approved`,
            metadata: {
              caseId,
              finalOutcome,
              approvedBy: supervisorId,
              supervisorComments: comments,
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send investigator notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure approved with final outcome ${finalOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`[ApproveCaseClosure] Case ${caseId} closure approved successfully with outcome ${finalOutcome}`, CaseService.name);

      return {
        message: 'Case closure approved',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
      };
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';

      this.logger.error(
        `[ApproveCaseClosure] Case closure approval failed for case ${caseId}: ${errorMessage}`,
        error.stack,
        CaseService.name,
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'System error occurred during case closure approval',
        caseId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        action: 'approveCaseClosure',
      });
    }
  }

  private validateCaseCompleteness(caseDetails: any): string[] {
    const missing: string[] = [];

    if (!caseDetails.priority) {
      missing.push('Case priority');
    }

    if (!caseDetails.case_type) {
      missing.push('Case type');
    }

    if (!caseDetails.case_creator_user_id) {
      missing.push('Case creator');
    }

    const hasInvestigationTask = caseDetails.tasks.some(
      (t) => (t.name === 'Investigate Case' || t.name === 'Investigate case') && t.status === TaskStatus.STATUS_30_COMPLETED,
    );

    if (!hasInvestigationTask) {
      missing.push('Completed investigation task');
    }

    const closureComments = caseDetails.comments.filter(
      (c) => c.note.includes('Recommended Outcome') || c.note.includes('Final Investigation Summary'),
    );

    if (closureComments.length === 0) {
      missing.push('Investigation closure recommendation');
    }

    return missing;
  }

  async rejectCaseClosure(caseId: string, comments: string, supervisorId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case closure for ${caseId}`, CaseService.name);

      await this.validateApprovalPreconditions(caseId, supervisorId, { autoClaimApprovalTask: true });

      if (!comments || comments.trim().length < 20) {
        const errorMsg = 'Rejection comments must be at least 20 characters';
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'rejectCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `Failed to reject case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException(errorMsg);
      }

      const caseDetails = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        include: {
          tasks: {
            where: {
              name: { in: ['Investigate Case', 'Investigate case'] },
              status: TaskStatus.STATUS_30_COMPLETED,
            },
            orderBy: { updated_at: 'desc' },
          },
        },
      });

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const originalInvestigationTask = caseDetails.tasks[0];
      const originalInvestigatorId = originalInvestigationTask?.assigned_user_id;

      if (!originalInvestigatorId) {
        throw new BadRequestException('Cannot determine original investigator for case reassignment');
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_20_IN_PROGRESS,
            updated_at: new Date(),
          },
        });

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: { in: ['Approve Case Closure', 'Approve case closure'] },
            assigned_user_id: supervisorId,
            status: {
              in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: approvalTask.task_id,
            note: `Case closure rejected by supervisor: ${comments}`,
          },
        });

        const updatedInvestigationTask = await tx.task.update({
          where: { task_id: originalInvestigationTask.task_id },
          data: {
            status: TaskStatus.STATUS_20_IN_PROGRESS,
            assigned_user_id: originalInvestigatorId,
            updated_at: new Date(),
          },
        });

        return { updatedCase, completedTask, updatedInvestigationTask };
      });

      this.eventEmitter.emit(
        'task.completed',
        new TaskCompletedEvent(result.completedTask.task_id, caseId, supervisorId, {
          approvalDecision: 'reject',
          supervisorComments: comments,
        }),
      );

      // const newInvestigationTask = await this.taskService.createTask(
      //     {
      //       caseId,
      //       status: TaskStatus.STATUS_10_ASSIGNED,
      //       assignedUserId: originalInvestigatorId,
      //       name: 'Investigate Case',
      //       description: 'Continue investigation based on supervisor feedback. Previous closure was rejected.',
      //       candidateGroup: 'investigations',
      //     },
      //     supervisorId,
      //     this.auditLogService,
      //     this.logger,
      // );

      // await this.prismaService.comment.create({
      //   data: {
      //     user_id: supervisorId,
      //     task_id: newInvestigationTask.task_id,
      //     note: `Supervisor Feedback:\n${comments}\n\nAction Required: Address the concerns raised and resubmit for closure approval.`,
      //   },
      // });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          CaseStatus.STATUS_20_IN_PROGRESS,
          `Case closure rejected and returned to investigation: ${comments}`,
        ),
      );

      try {
        await this.notificationService.sendNotification({
          userId: originalInvestigatorId,
          type: 'CASE_CLOSURE_REJECTED',
          message: `Your case closure for case ${caseId} was rejected by supervisor`,
          metadata: {
            caseId,
            taskId: originalInvestigationTask.task_id,
            supervisorComments: comments,
            rejectedBy: supervisorId,
          },
        });
      } catch (notificationError) {
        this.logger.warn(`Failed to send investigator notification: ${notificationError.message}`, CaseService.name);
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure rejected and reassigned to investigator ${originalInvestigatorId}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `Case ${caseId} closure rejected successfully. Investigation task ${originalInvestigationTask.task_id} updated back to in progress`,
        CaseService.name,
      );

      return {
        message: 'Case closure rejected and returned for investigation',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_approval_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        investigation_task: {
          task_id: originalInvestigationTask.task_id,
          name: originalInvestigationTask.name,
          assigned_to: originalInvestigatorId,
          status: originalInvestigationTask.status,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to reject case closure: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async returnCaseForReview(caseId: string, comments: string, supervisorId: string) {
    try {
      await this.validateApprovalPreconditions(caseId, supervisorId, { autoClaimApprovalTask: true });

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: 'Approve case closure',
            assigned_user_id: supervisorId,
            status: {
              in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        await tx.comment.create({
          data: { user_id: supervisorId, task_id: approvalTask.task_id, note: `Returned for review: ${comments}` },
        });

        return { updatedCase, completedTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          CaseStatus.STATUS_20_IN_PROGRESS,
          `Returned for review: ${comments}`,
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'returnCaseForReview',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} returned for additional review`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case returned for additional review',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
      };
    } catch (error) {
      this.logger.error(`Failed to return case for review: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async reopenCase(caseId: string, reason: string, userId: string, tenantId: string, role: string) {
    try {
      this.logger.log(`Investigator ${userId} reopening case ${caseId}`, CaseService.name);

      const existingCase = await this.retrieveCase(caseId);

      const allowedStates: CaseStatus[] = [
        CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
        CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
        CaseStatus.STATUS_81_CLOSED_REFUTED,
        CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
      ];

      if (!allowedStates.includes(existingCase.status)) {
        throw new BadRequestException(`Case ${caseId} is not in a valid closed state for reopening`);
      }

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Reason for reopening case is required and must be at least 10 characters');
      }

      const isSupervisor = role === 'CMS_SUPERVISOR';

      if (isSupervisor) {
        const result = await this.prismaService.$transaction(async (tx) => {
          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: CaseStatus.STATUS_10_ASSIGNED,
              updated_at: new Date(),
            },
          });

          return { case: updatedCase };
        });

        this.eventEmitter.emit(
          'case.status.changed',
          new CaseStatusChangedEvent(caseId, existingCase.status, CaseStatus.STATUS_10_ASSIGNED, `Case reopening requested: ${reason}`),
        );

        await this.auditLogService.logAction({
          userId,
          operation: 'reopenCase',
          entityName: CaseService.name,
          actionPerformed: `Reopened case ${caseId} Reason: ${reason}`,
          outcome: Outcome.SUCCESS,
        });

        return {
          success: true,
          message: 'Case reopened ',
          case: result.case,
        };
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
            updated_at: new Date(),
          },
        });

        const approvalTask = await this.taskService.createTask(
          {
            caseId,
            name: 'Approve Case Reopening',
            status: TaskStatus.STATUS_01_UNASSIGNED,
            description: `Case reopening approval required. Reason: ${reason}`,
            candidateGroup: 'supervisors',
          },
          userId,
          this.auditLogService,
          this.logger,
        );

        await tx.comment.create({
          data: {
            user_id: userId,
            task_id: approvalTask.task_id,
            note: JSON.stringify({
              requestedBy: userId,
              requesterRole: role || 'UNKNOWN',
              reason,
              previousStatus: existingCase.status,
              requestedAt: new Date().toISOString(),
            }),
          },
        });

        return { case: updatedCase, approvalTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          existingCase.status,
          CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
          `Case reopening requested: ${reason}`,
        ),
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'reopenCase',
        entityName: CaseService.name,
        actionPerformed: `Reopened case ${caseId} pending supervisor approval. Reason: ${reason}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        message: 'Case reopened and pending supervisor approval',
        case: result.case,
        approvalTask: result.approvalTask,
      };
    } catch (error) {
      this.logger.error(`Failed to reopen case ${caseId}: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'reopenCase',
        entityName: CaseService.name,
        actionPerformed: `Failed to reopen case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async abandonCase(caseId: string, reason: string, userId: string, tenantId: string) {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for abandonment is required');
    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case doesn't exist for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Cannot abandon case other than draft status');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
    if (!completeNewCaseTask) throw new BadRequestException('No complete new Case Task exists');
    if (completeNewCaseTask?.status === TaskStatus.STATUS_30_COMPLETED) {
      throw new BadRequestException(`Cannot update Complete New Case task ${completeNewCaseTask.task_id} as it is already completed`);
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_99_ABANDONED }, userId);
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          this.auditLogService,
        );
        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = reason;
        this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'abandonCase',
          entityName: CaseService.name,
          actionPerformed: `Abandon case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      this.eventEmitter.emit('case.abandoned', new CaseAbandonedEvent(caseId, reason));

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('abandonCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to abandon case : ${err.message}`);
    }
  }

  async completeCase(caseId: string, userId: string, tenantId: string) {
    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Only cases in DRAFT status can be completed');

    const missingFields = this.validateCaseCompletionFields(existingCase);
    if (missingFields.length > 0) {
      const msg = `Missing or invalid fields: ${missingFields.join(', ')}`;
      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseService.name,
        actionPerformed: `Failed case completion due to missing fields [${missingFields.join(', ')}]`,
        outcome: Outcome.FAILURE,
      });
      throw new BadRequestException(msg);
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }, userId);
        const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
        const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
        if (!completeNewCaseTask) throw new BadRequestException('No Complete New Case task found');
        if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
          throw new BadRequestException(`Complete New Case task ${completeNewCaseTask.task_id} is already completed`);
        }
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          this.auditLogService,
        );

        return { case: updatedCase, completedTask: updatedTask };
      });

      const investigateTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate case',
          description: `Task to investigate: ${caseId}`,
          candidateGroup: 'investigations',
        },
        userId,
        this.auditLogService,
        this.logger,
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_00_DRAFT,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          'Case completed and ready for assignment',
        ),
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseService.name,
        actionPerformed: `Completed case ${caseId} and created Investigate Case task ${investigateTask.task_id}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: investigateTask };
    } catch (err) {
      this.logger.error('completeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to complete case: ${err.message}`);
    }
  }

  private validateCaseCompletionFields(existingCase: any): string[] {
    const missing: string[] = [];
    if (!existingCase.priority) missing.push('priority');
    if (!existingCase.case_type) missing.push('case_type');
    return missing;
  }
  private async validateApprovalPreconditions(caseId: string, supervisorId?: string, options: { autoClaimApprovalTask?: boolean } = {}) {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: { tasks: true },
    });

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending final approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        caseId,
      });
    }

    let approvalValidation = TaskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
      requireClaim: Boolean(supervisorId),
      expectedAssignee: supervisorId,
    });

    const shouldAttemptAutoClaim =
      options.autoClaimApprovalTask &&
      Boolean(supervisorId) &&
      approvalValidation.approvalTask &&
      (approvalValidation.approvalTask.status === TaskStatus.STATUS_01_UNASSIGNED || !approvalValidation.approvalTask.assigned_user_id) &&
      approvalValidation.errors.some((err) => err.toLowerCase().includes('must be claimed'));

    if (shouldAttemptAutoClaim) {
      const approvalTaskId = approvalValidation.approvalTask!.task_id;
      this.logger.log(`Auto-claiming approval task ${approvalTaskId} for supervisor ${supervisorId}`, CaseService.name);
      await this.taskService.claimTask(approvalTaskId, supervisorId!, this.auditLogService);

      const taskIndex = caseData.tasks.findIndex((task) => task.task_id === approvalTaskId);
      if (taskIndex >= 0) {
        caseData.tasks[taskIndex].assigned_user_id = supervisorId!;
        caseData.tasks[taskIndex].status = TaskStatus.STATUS_10_ASSIGNED;
      }

      approvalValidation = TaskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
        requireClaim: Boolean(supervisorId),
        expectedAssignee: supervisorId,
      });
    }

    TaskValidationUtil.throwIfValidationFails(approvalValidation, 'Approval task validation failed');

    const approvalTask = approvalValidation.approvalTask;

    if (!approvalTask) {
      throw new NotFoundException('Approval task not found');
    }

    const otherTasksValidation = TaskValidationUtil.validateOtherTasksCompleted(caseData.tasks, [approvalTask.task_id]);

    if (!otherTasksValidation.isValid) {
      throw new BadRequestException({
        message: 'All other tasks must be completed before approval',
        incompleteTasks: TaskValidationUtil.filterTasks(caseData.tasks, {
          excludeTaskIds: [approvalTask.task_id],
          excludeStatuses: [TaskStatus.STATUS_30_COMPLETED],
        }).map((task) => ({
          taskId: task.task_id,
          name: task.name,
          status: task.status,
        })),
        caseId,
      });
    }

    return { caseData, approvalTask };
  }

  async getUserCases(userId: string, query: GetUserCasesQueryDto, isComplianceOfficer?: boolean) {
    try {
      const {
        status,
        priority,
        includeTaskAssignments,
        includeOwnedCases,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const skip = (page - 1) * limit;
      const whereConditions: any[] = [];

      if (includeOwnedCases) {
        const ownedCasesCondition: any = { case_owner_user_id: userId };
        if (status) ownedCasesCondition.status = status;
        if (priority) ownedCasesCondition.priority = priority;
        // Compliance officers only see STATUS_82_CLOSED_CONFIRMED cases
        if (isComplianceOfficer) ownedCasesCondition.status = 'STATUS_82_CLOSED_CONFIRMED';
        whereConditions.push(ownedCasesCondition);
      }

      if (includeTaskAssignments) {
        const taskAssignmentCondition: any = { tasks: { some: { assigned_user_id: userId } } };
        if (status) taskAssignmentCondition.status = status;
        if (priority) taskAssignmentCondition.priority = priority;
        // Compliance officers only see STATUS_82_CLOSED_CONFIRMED cases
        if (isComplianceOfficer) taskAssignmentCondition.status = 'STATUS_82_CLOSED_CONFIRMED';
        whereConditions.push(taskAssignmentCondition);
      }

      if (whereConditions.length === 0) {
        return {
          cases: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
          summary: { totalOwnedCases: 0, totalTaskAssignments: 0, casesByStatus: {}, casesByPriority: {} },
        };
      }

      const totalCount = await this.prismaService.case.count({ where: { OR: whereConditions } });
      const cases = await this.prismaService.case.findMany({
        where: { OR: whereConditions },
        include: {
          tasks: { orderBy: { created_at: 'desc' } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, priority: true, alert_type: true, transaction: true } },
          comments: { select: { comment_id: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 1 },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        const isOwner = caseItem.case_owner_user_id === userId;
        const userTasks = TaskValidationUtil.getUserAssignedTasks(caseItem.tasks, userId);
        const hasTaskAssignment = userTasks.length > 0;
        const userRole: 'owner' | 'task_assignee' | 'both' = isOwner && hasTaskAssignment ? 'both' : isOwner ? 'owner' : 'task_assignee';

        return {
          case_id: caseItem.case_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          user_role: userRole,
          user_tasks: userTasks.map((task) => ({
            task_id: task.task_id,
            name: task.name,
            status: task.status,
            created_at: task.created_at,
          })),
          total_tasks: caseItem.tasks.length,
          alert: caseItem.alert
            ? {
                alert_id: caseItem.alert.alert_id,
                message: caseItem.alert.message,
                confidence_per: caseItem.alert.confidence_per,
                transaction: caseItem.alert.transaction,
              }
            : undefined,
          latest_comment_date: caseItem.comments[0]?.created_at,
        };
      });

      const [ownedCasesCount, taskAssignmentCasesCount, casesByStatus, casesByPriority] = await Promise.all([
        this.prismaService.case.count({ where: { case_owner_user_id: userId } }),
        this.prismaService.case.count({ where: { tasks: { some: { assigned_user_id: userId } } } }),
        this.prismaService.case.groupBy({ by: ['status'], where: { OR: whereConditions }, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: { OR: whereConditions }, _count: { case_id: true } }),
      ]);

      const statusCounts = casesByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const priorityCounts = casesByPriority.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        summary: {
          totalOwnedCases: ownedCasesCount,
          totalTaskAssignments: taskAssignmentCasesCount,
          casesByStatus: statusCounts,
          casesByPriority: priorityCounts,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user cases: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async getAllCases(query: GetAllCasesQueryDto, tenantId: string, investigatorUserId?: string, isComplianceOfficer?: boolean) {
    try {
      const {
        status,
        priority,
        caseType,
        ownerId,
        unassignedOnly,
        createdAfter,
        createdBefore,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const whereClause: any = {};

      // Build base filters
      const baseFilters: any = {};
      if (status) baseFilters.status = status;
      if (priority) baseFilters.priority = priority;
      if (caseType) baseFilters.case_type = caseType;
      if (tenantId) baseFilters.tenant_id = tenantId;

      if (createdAfter || createdBefore) {
        baseFilters.created_at = {};
        if (createdAfter) baseFilters.created_at.gte = new Date(createdAfter);
        if (createdBefore) baseFilters.created_at.lte = new Date(createdBefore);
      }

      // Handle compliance officer filtering - only show STATUS_82_CLOSED_CONFIRMED cases
      if (isComplianceOfficer) {
        baseFilters.status = 'STATUS_82_CLOSED_CONFIRMED';
        Object.assign(whereClause, baseFilters);
      }
      // Handle investigator filtering (only unassigned, ready for assignment, or assigned to them)
      else if (investigatorUserId) {
        // Investigator filter: show only unassigned, ready for assignment, OR assigned to them
        whereClause.AND = [
          baseFilters, // Apply all other filters
          {
            OR: [
              { case_owner_user_id: null }, // Unassigned cases
              { status: 'STATUS_02_READY_FOR_ASSIGNMENT' }, // Cases ready for assignment
              { case_owner_user_id: investigatorUserId }, // Cases assigned to this investigator
            ],
          },
        ];
      } else {
        // Supervisor/Admin can filter by ownerId or unassignedOnly
        Object.assign(whereClause, baseFilters);
        if (ownerId) whereClause.case_owner_user_id = ownerId;
        if (unassignedOnly) whereClause.case_owner_user_id = null;
      }

      const skip = (page - 1) * limit;
      const totalCount = await this.prismaService.case.count({ where: whereClause });
      const cases = await this.prismaService.case.findMany({
        where: whereClause,
        include: {
          tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true, transaction: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        const taskCounts = TaskValidationUtil.getTaskStatusCounts(caseItem.tasks);
        const assignedUsers = [...new Set(caseItem.tasks.map((t) => t.assigned_user_id).filter(Boolean))];
        return {
          case_id: caseItem.case_id,
          tenant_id: caseItem.tenant_id,
          case_creator_user_id: caseItem.case_creator_user_id,
          case_owner_user_id: caseItem.case_owner_user_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          total_tasks: caseItem.tasks.length,
          completed_tasks: taskCounts.completed,
          pending_tasks: taskCounts.pending,
          alert: caseItem.alert,
          assigned_to:
            assignedUsers.length > 0
              ? { user_id: caseItem.case_owner_user_id || assignedUsers[0], task_count: assignedUsers.length }
              : undefined,
        };
      });

      const [statusStats, priorityStats, typeStats, unassignedCount] = await Promise.all([
        this.prismaService.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['case_type'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.count({ where: { case_owner_user_id: null } }),
      ]);

      const casesByStatus = statusStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const casesByPriority = priorityStats.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const casesByType = typeStats.reduce(
        (acc, item) => {
          if (item.case_type) acc[item.case_type] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const totalTasks = cases.reduce((sum, c) => sum + c.tasks.length, 0);
      const averageTasksPerCase = cases.length > 0 ? Math.round((totalTasks / cases.length) * 10) / 10 : 0;

      let oldestUnassignedCase: { case_id: string; created_at: Date; days_old: number } | undefined;
      if (unassignedCount > 0) {
        const oldestUnassigned = await this.prismaService.case.findFirst({
          where: { case_owner_user_id: null },
          orderBy: { created_at: 'asc' },
          select: { case_id: true, created_at: true },
        });
        if (oldestUnassigned) {
          const daysOld = Math.floor((new Date().getTime() - oldestUnassigned.created_at.getTime()) / (1000 * 60 * 60 * 24));
          oldestUnassignedCase = { case_id: oldestUnassigned.case_id, created_at: oldestUnassigned.created_at, days_old: daysOld };
        }
      }

      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        statistics: {
          totalCases: totalCount,
          casesByStatus,
          casesByPriority,
          casesByType,
          unassignedCases: unassignedCount,
          averageTasksPerCase,
          oldestUnassignedCase,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all cases: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async getUserWorkloadStats(userId: string, isComplianceOfficer?: boolean) {
    try {
      // For compliance officers, filter to only STATUS_82_CLOSED_CONFIRMED cases
      const statusFilter = isComplianceOfficer
        ? { status: CaseStatus.STATUS_82_CLOSED_CONFIRMED }
        : {
            status: {
              notIn: [
                CaseStatus.STATUS_81_CLOSED_REFUTED,
                CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                CaseStatus.STATUS_99_ABANDONED,
              ],
            },
          };

      const [activeCases, pendingTasks, allUserCases] = await Promise.all([
        this.prismaService.case.count({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            ...statusFilter,
          },
        }),
        this.prismaService.task.count({
          where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        }),
        this.prismaService.case.findMany({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            ...statusFilter,
          },
          select: { case_id: true, status: true, priority: true, created_at: true },
          orderBy: { created_at: 'asc' },
        }),
      ]);

      const now = new Date();
      let oldestCase: { case_id: string; created_at: Date; days_old: number } | null = null;
      let totalAge = 0;

      if (allUserCases.length > 0) {
        const oldest = allUserCases[0];
        const daysOld = Math.floor((now.getTime() - oldest.created_at.getTime()) / (1000 * 60 * 60 * 24));
        oldestCase = { case_id: oldest.case_id, created_at: oldest.created_at, days_old: daysOld };
        allUserCases.forEach((c) => {
          totalAge += (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24);
        });
      }

      const casesByStatus: Record<string, number> = {};
      const casesByPriority: Record<string, number> = {};
      allUserCases.forEach((c) => {
        casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
        casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
      });

      const averageCaseAge = allUserCases.length > 0 ? Math.round((totalAge / allUserCases.length) * 10) / 10 : 0;
      const upcomingDeadlines = await this.prismaService.task.findMany({
        where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        select: { task_id: true, name: true, case_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: 5,
      });

      return {
        totalActiveCases: activeCases,
        totalPendingTasks: pendingTasks,
        casesByStatus,
        casesByPriority,
        oldestCase,
        averageCaseAge,
        upcomingTasks: upcomingDeadlines.map((task) => ({
          task_id: task.task_id,
          name: task.name,
          case_id: task.case_id,
          days_old: Math.floor((now.getTime() - task.created_at.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get workload stats: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  
  private async createSARFilingTask(caseId: string, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Creating SAR_STR_FILING task for case ${caseId}`, CaseService.name);

    try {
     
      const existingSARTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          task_type: 'SAR_STR_FILING' as any,
        },
      });

      if (existingSARTask) {
        this.logger.log(`SAR_STR_FILING task already exists for case ${caseId}: ${existingSARTask.task_id}`, CaseService.name);
        return;
      }

      
      const complianceQueue = await this.prismaService.workQueue.findFirst({
        where: {
          tenant_id: tenantId,
          is_active: true,
          name: {
            contains: 'compliance',
            mode: 'insensitive',
          },
        },
      });

      const taskData: any = {
        case: {
          connect: { case_id: caseId },
        },
        status: TaskStatus.STATUS_01_UNASSIGNED,
        name: 'SAR_STR_FILING',
        description:
          'Upload the official SAR/STR submission acknowledgment from FIU. Include submission date, reference number, and submission channel.',
        task_type: 'SAR_STR_FILING',
        candidateGroup: 'compliance',
        sla_duration_hours: 48, 
      };

      if (complianceQueue) {
        taskData.workQueue = {
          connect: { work_queue_id: complianceQueue.work_queue_id },
        };
      }

      const sarTask = await this.prismaService.task.create({
        data: taskData,
      });

      
      this.eventEmitter.emit(
        'task.created',
        new TaskCreatedEvent(
          sarTask.task_id,
          caseId,
          sarTask.name || 'SAR_STR_FILING',
          sarTask.description || 'Upload SAR/STR acknowledgment from FIU',
          sarTask.candidateGroup || 'compliance',
          sarTask.status,
          undefined,
        ),
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'createSARTask',
        entityName: CaseService.name,
        actionPerformed: `Auto-generated SAR_STR_FILING task ${sarTask.task_id} for confirmed case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Successfully created SAR_STR_FILING task ${sarTask.task_id} for case ${caseId}`, CaseService.name);
    } catch (error) {
     
        this.logger.error(`Failed to create SAR_STR_FILING task for case ${caseId}: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'createSARTask',
        entityName: CaseService.name,
        actionPerformed: `Failed to create SAR_STR_FILING task for case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });
    }
  }

  async retrieveCase(caseId: string, isComplianceOfficer?: boolean) {
    const retrievedCase = await this.prismaService.case.findUnique({ where: { case_id: caseId }, include: { alert: true, tasks: true } });
    if (!retrievedCase) throw new NotFoundException(`Case not found: ${caseId}`);
    
    // Compliance officers can only access STATUS_82_CLOSED_CONFIRMED cases
    if (isComplianceOfficer && retrievedCase.status !== 'STATUS_82_CLOSED_CONFIRMED') {
      throw new ForbiddenException('Compliance officers can only access confirmed closed cases');
    }
    
    return retrievedCase;
  }

  async updateCase(caseId: string, updateData: Partial<UpdateCaseDto>, userId: string) {
    try {
      const updatedCase = await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          case_type: updateData.caseType,
          priority: updateData.priority,
          status: updateData.status,
          case_owner_user_id: updateData.caseOwnerUserId,
        },
      });

      this.auditLogService.logAction({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(`Error updating case: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }
}
