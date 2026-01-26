import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { TaskService } from '../task/task.service';
import { CasePriorityUtil } from '../shared/utils/case-priority.util';
import { Priority, CaseStatus, CaseType, Prisma, TaskStatus, TaskType } from '@prisma/client-cms';
import { AIPrediction, Prediction } from '../../utils/interfaces/Prediction';
import { CaseStatusChangedEvent } from '../events/domain-events';
import { FeatureExtractionService } from 'src/modules/feature-extraction/feature-extraction.service';
import axios from 'axios';
import { AlertService } from '../alert/alert.service';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { CaseRepository } from '../repository/case.repository';
import { FlowableService } from '../flowable/flowable.service';
import { Outcome } from '../../utils/types/outcome';
import { ManualAlertUpdateDTO, IngestAlertDto } from '../alert/dto';
import { UpdateAlertDTO } from '../alert/dto';
import { EventLogService } from '../event_log/eventLog.service';
import { CaseHistoryService } from '../case_history/caseHistory.service';
import { TaskHistoryService } from '../task_history/taskHistory.service';
import { TaskSyncService } from '../task-sync/task-sync.service';
import { FlowableProcessService } from '../flowable/services/flowable-process.service';

@Injectable()
export class TriageService {
  private readonly closableStatuses: CaseStatus[] = [
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  ];

  constructor(
    private readonly loggerService: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly flowableService: FlowableService,
    private readonly alertService: AlertService,
    private audit: AuditLogService,
    private eventLogService: EventLogService,
    private readonly caseCreationService: CaseCreationApprovalService,
    private taskService: TaskService,
    private configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly featureExtractionService: FeatureExtractionService,
    private readonly caseHistoryService: CaseHistoryService,
    private readonly taskHistoryService: TaskHistoryService,
    private readonly syncTaskService: TaskSyncService,
    private readonly flowableProcessService: FlowableProcessService,
  ) {}

  async handleManualTriage(alertId: number, updateAlertDto: ManualAlertUpdateDTO, userId: string, tenantId: string) {
    this.loggerService.log(`Start - handleManualTriage`, TriageService.name);
    try {
      const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
      if (triageType !== 'MANUAL') {
        throw new BadRequestException(`Cannot update alert ${alertId} when triageType is not MANUAL`);
      }

      const priorityScore = updateAlertDto.priorityScore ?? 0.0;
      const priority = this.casePriorityUtil.determinePriority(priorityScore);
      updateAlertDto.priority = priority;
      const alert = await this.alertService.updateAlert(alertId, userId, {
        confidencePer: updateAlertDto.confidence_per,
        priority: updateAlertDto.priority,
        priority_score: updateAlertDto.priorityScore,
        predictionOutcome: updateAlertDto.predictionOutcome,
        alertType: updateAlertDto.alertType,
      });
      if (!alert.case_id) {
        throw new InternalServerErrorException('Alert case_id is missing.');
      }

      const existingCase = await this.caseRepository.findCaseById(alert.case_id);

      const completeCaseTask = existingCase.tasks.find((task) => task.task_type === TaskType.CASE_CREATION);
      if (!completeCaseTask || completeCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
        throw new BadRequestException(`Task Not Found or Triage Already Completed`);
      }

      if (completeCaseTask.assigned_user_id !== null && completeCaseTask.assigned_user_id !== userId) {
        throw new BadRequestException(`Task is assigned to another user`);
      }

      const result = await this.taskService.claimTask(existingCase.case_id, userId, TaskType.CASE_CREATION);
      this.loggerService.log(`Claimed Task: ${JSON.stringify(result)}`, TriageService.name);

      // const targetFlowableTask = await this.syncTaskService.syncTaskCompletionWithFlowable(
      //   userId,
      //   existingCase.case_id,
      //   TaskType.CASE_CREATION,
      //   {
      //     status: TaskStatus.STATUS_30_COMPLETED,
      //     assignedUserId: userId,
      //     casePriority: alert.priority as Priority,
      //     caseType: alert.alert_type as CaseType,
      //   },
      // );
      // await this.flowableProcessService.updateProcessVariable(existingCase.case_id, 'caseStatus', updateAlertDto.status);

      // this.loggerService.log(`Target Flowable Task: ${JSON.stringify(targetFlowableTask)}`, TriageService.name);

      // await this.syncTaskService.syncTaskCompletionWithFlowable(userId, existingCase.case_id, TaskType.CASE_CREATION, {});

      // const completeNewCaseTask = existingCase.tasks.find
      //   const completeNewCaseTask = existingCase.tasks.find((t) => t.name === 'Complete New Case');
      //   if (!completeNewCaseTask || completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
      //     throw new BadRequestException(`Triage Already Complete`);
      //   }
      //   await this.taskService.updateTask(
      //     completeNewCaseTask.task_id,
      //     { assignedUserId: userId, status: TaskStatus.STATUS_30_COMPLETED },
      //     userId,
      //   );
      //   await this.commentService.addComment(
      //     { caseId: alert.case_id, taskId: completeNewCaseTask?.task_id, note: updateAlertDto.note } as CreateCommentDto,
      //     userId,
      //   );
      //   if (this.closableStatuses.includes(existingCase.status)) {
      //     throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
      //   }
      //   if (updateAlertDto?.status && this.closableStatuses.includes(updateAlertDto.status)) {
      //     await this.caseCreationService.updateCaseStatus(alert.case_id, updateAlertDto.status, userId);
      //     await this.flowableService.handleTaskCompleted({
      //       caseId: existingCase.case_id,
      //       newStatus: TaskStatus.STATUS_30_COMPLETED,
      //       taskName: completeNewCaseTask.name!,
      //       completionVariables: {
      //         autoCloseEligible: true,
      //         caseType: updateAlertDto.alertType,
      //         casePriority: alert.priority,
      //         readyForAssignment: false,
      //       },
      //     });
      //     await this.flowableService.handleTaskCompleted({
      //       caseId: existingCase.case_id,
      //       newStatus: TaskStatus.STATUS_30_COMPLETED,
      //       taskName: 'Auto Close',
      //       completionVariables: {
      //         autoCloseType: updateAlertDto.status,
      //         autoCloseReason: updateAlertDto.note,
      //       },
      //     });
      //     this.loggerService.log(
      //       `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Closed as ${updateAlertDto.status}`,
      //       TriageService.name,
      //     );
      //   } else {
      //     await this.caseCreationService.updateCaseStatus(
      //       alert.case_id,
      //       CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      //       userId,
      //       priority,
      //       updateAlertDto.alertType as CaseType,
      //     );
      //     await this.flowableService.handleTaskCompleted({
      //       caseId: existingCase.case_id,
      //       newStatus: TaskStatus.STATUS_30_COMPLETED,
      //       taskName: completeNewCaseTask.name!,
      //       completionVariables: {
      //         autoCloseEligible: false,
      //         caseType: updateAlertDto.alertType,
      //         casePriority: alert.priority,
      //         readyForAssignment: true,
      //       },
      //     });

      //     this.loggerService.log(
      //       `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Sent to investigation`,
      //       TriageService.name,
      //     );
      //   }
      this.loggerService.log('End - handleManualTriage', TriageService.name);
      return alert;
    } catch (error) {
      this.loggerService.error(`Manual triage failed for alert ${alertId}: ${error.message}`, error.stack, TriageService.name);
      throw error;
    }
  }

  async handleAITriage(alertId: number, caseId: number, dto: IngestAlertDto, userId: string, tenantId: string) {
    this.loggerService.log(`Start - AI Triage for alert ${alertId}`, TriageService.name);
    try {
      const triageTask = await this.taskService.createTask(
        {
          caseId: caseId,
          assignedUserId: userId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          name: 'Complete New Case',
          description: `Created for triaging alert for case:${caseId}`,
          candidateGroup: 'investigator',
          taskType: TaskType.CASE_CREATION,
        },
        userId,
      );

      const triageTaskId = triageTask.task_id;
      const confidenceThreshold = this.configService.get<number>('CONFIDENCE_THRESHOLD', 100);
      const interdictionEnabled = this.configService.get<string>('CLIENT_SYSTEM_INTERDICTION_ENABLED', 'true').toLowerCase() === 'true';
      let transactionOccurred = true;

      if (interdictionEnabled) {
        const tadpResult = dto?.report?.tadpResult;

        if (
          typeof tadpResult === 'object' &&
          tadpResult !== null &&
          'typologyResult' in tadpResult &&
          Array.isArray((tadpResult as any).typologyResult)
        ) {
          const typology = (tadpResult as any).typologyResult[0];
          const result = typeof typology?.result === 'number' ? typology.result : undefined;
          const interdictionThreshold =
            typeof typology?.workflow?.interdictionThreshold === 'number' ? typology.workflow.interdictionThreshold : undefined;

          if (result !== undefined && interdictionThreshold !== undefined && result > interdictionThreshold) {
            transactionOccurred = false;
          }
        }
      }

      const prediction: Prediction = await this.predictAlert(dto);
      const {
        confidence_per: predictedConfidence,
        alertType: predictedAlertType,
        isTruePositive: predictedTruePositive,
        priorityScore: predictedPriorityScore,
      } = prediction;

      const finalPriorityScore = predictedPriorityScore ?? 0.5;
      const priority = this.casePriorityUtil.determinePriority(finalPriorityScore);

      await this.updateAlertAndUpdateTriageTask(
        alertId,
        triageTaskId,
        predictedAlertType,
        predictedConfidence,
        finalPriorityScore,
        priority,
        predictedTruePositive,
        userId,
      );

      if (predictedConfidence < confidenceThreshold) {
        await this.flowableService.handleTaskCompleted({
          caseId: caseId,
          taskName: triageTask.name!,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            autoCloseEligible: false,
            caseType: predictedAlertType,
            casePriority: priority,
            readyForAssignment: true,
          },
        });
        return await this.createInvestigationTask(
          caseId,
          userId,
          triageTaskId,
          'Triage complete - confidence percentage below threshold manual investigation needed',
          priority,
          predictedAlertType,
        );
      }

      if (predictedConfidence >= confidenceThreshold && !predictedTruePositive) {
        await this.flowableService.handleTaskCompleted({
          caseId: caseId,
          taskName: triageTask.name!,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            autoCloseEligible: true,
            caseType: predictedAlertType,
            casePriority: priority,
            readyForAssignment: false,
          },
        });
        return await this.autoCloseCase(
          caseId,
          CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
          userId,
          triageTaskId,
          predictedAlertType,
          'Triage complete - false positive (case auto-closed refuted)',
        );
      }

      if (predictedTruePositive) {
        if (predictedAlertType === CaseType.FRAUD_AND_AML) {
          await this.taskService.updateTask(
            triageTaskId,
            {
              status: TaskStatus.STATUS_30_COMPLETED,
              description: 'Triage complete - true positive and case contains both fraud and aml',
            },
            userId,
          );
          await this.flowableService.handleTaskCompleted({
            caseId: caseId,
            taskName: triageTask.name!,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              autoCloseEligible: false,
              caseType: predictedAlertType,
              casePriority: priority,
              readyForAssignment: true,
            },
          });

          await this.caseCreationService.updateCaseStatus(
            caseId,
            CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            userId,
            priority,
            predictedAlertType,
          );
          return;
        }

        if (predictedAlertType === CaseType.AML) {
          await this.flowableService.handleTaskCompleted({
            caseId: caseId,
            taskName: triageTask.name!,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              autoCloseEligible: false,
              caseType: predictedAlertType,
              casePriority: priority,
              readyForAssignment: true,
            },
          });
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Triage complete - confidence percentage above threshold and true positive with case type aml',
            priority,
            predictedAlertType,
          );
        }

        if (predictedAlertType === CaseType.FRAUD) {
          if (!transactionOccurred) {
            await this.flowableService.handleTaskCompleted({
              caseId: caseId,
              taskName: triageTask.name!,
              newStatus: TaskStatus.STATUS_30_COMPLETED,
              completionVariables: {
                autoCloseEligible: true,
                caseType: predictedAlertType,
                casePriority: priority,
                readyForAssignment: false,
              },
            });
            return await this.autoCloseCase(
              caseId,
              CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
              userId,
              triageTaskId,
              predictedAlertType,
              'Triage complete - true positive (case auto-closed confirmed)',
            );
          }

          await this.flowableService.handleTaskCompleted({
            caseId: caseId,
            taskName: triageTask.name!,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              autoCloseEligible: false,
              caseType: predictedAlertType,
              casePriority: priority,
              readyForAssignment: true,
            },
          });
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Triage complete - confidence percentage above threshold and true positive with case type fraud and transaction occured',
            priority,
            predictedAlertType,
          );
        }
      }
    } catch (error) {
      this.loggerService.error(`Triage failed for alert ${alertId}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'AI_TRIAGE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Triage failed for alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Triage process failed');
    }
  }

  private async autoCloseCase(
    caseId: number,
    status: CaseStatus,
    userId: string,
    taskId: number,
    caseType?: CaseType,
    customDescription?: string,
  ) {
    try {
      const existingCase = await this.caseRepository.findCaseById(caseId);

      if (!existingCase) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const updatedTask = await this.taskService.updateTask(
        taskId,
        {
          status: TaskStatus.STATUS_30_COMPLETED,
          description: customDescription ?? `Auto-closed case with status ${status}`,
        },
        userId,
      );

      const updatedCase = await this.caseCreationService.updateCaseStatus(caseId, status, userId, undefined, caseType);

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(caseId, status, customDescription || `Case automatically closed with status ${status}`),
      );

      await this.audit.logAction({
        userId,
        operation: 'CASE_AUTO_CLOSED',
        entityName: 'Case',
        actionPerformed: `Auto-closed case ${caseId} with status: ${status}`,
        outcome: 'SUCCESS',
      });

      await this.eventLogService.logEventAction({
        userId,
        operation: 'case auto closed',
        entityName: 'Case',
        actionPerformed: `Auto-closed case ${caseId} with status: ${status}`,
        outcome: 'SUCCESS',
      });

      await this.caseHistoryService.logCaseHistoryAction({
        userId,
        operation: 'case auto closed',
        entityName: 'Case',
        actionPerformed: `Auto-closed case ${caseId} with status: ${status}`,
        case_id: caseId,
      });

      return { updatedCase, updatedTask };
    } catch (error) {
      this.loggerService.error(`Auto-close failed for case ${caseId}`, error);
      await this.audit.logAction({
        userId,
        operation: 'CASE_AUTO_CLOSE_FAILED',
        entityName: 'Case',
        actionPerformed: `Failed to auto close case ${caseId}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to auto close case');
    }
  }

  private async createInvestigationTask(
    caseId: number,
    userId: string,
    taskId: number,
    triageTaskDesc: string,
    priority: Priority,
    alertType?: CaseType,
  ): Promise<unknown> {
    try {
      this.loggerService.log(`Start - AI triage completed for case ${caseId}`, TriageService.name);
      const existingCase = await this.caseRepository.findCaseById(caseId);
      if (!existingCase) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      await this.taskService.updateTask(taskId, { status: TaskStatus.STATUS_30_COMPLETED, description: triageTaskDesc }, userId);

      const updatedCase = await this.caseCreationService.updateCaseStatus(
        caseId,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        userId,
        priority,
        alertType as CaseType,
      );

      await this.audit.logAction({
        userId,
        operation: 'INVESTIGATION_TASK_TRIGGERED',
        entityName: 'Task',
        actionPerformed: `AI triage completed for case ${caseId}. BPMN will create investigation task.`,
        outcome: 'SUCCESS',
      });

      await this.eventLogService.logEventAction({
        userId,
        operation: 'Investigation task triggered',
        entityName: 'Task',
        actionPerformed: `AI triage completed for case ${caseId}. BPMN will create investigation task.`,
        outcome: 'SUCCESS',
      });

      await this.taskHistoryService.logTaskHistoryAction({
        userId,
        operation: 'Investigation task triggered',
        entityName: 'Task',
        actionPerformed: `AI triage completed for case ${caseId}. BPMN will create investigation task.`,
        case_id: caseId,
        task_id: taskId,
      });

      this.loggerService.log(`End - AI triage completed for case ${caseId}`, TriageService.name);

      return {
        case: updatedCase,
        message: 'Triage completed. Investigation task will be created by workflow engine.',
      };
    } catch (error) {
      this.loggerService.error(`Failed to complete triage for case ${caseId}. Error: ${error.message}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'INVESTIGATION_TASK_TRIGGER_FAILED',
        entityName: 'Task',
        actionPerformed: `Failed to complete triage for case ${caseId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to complete triage');
    }
  }

  private async updateAlertAndUpdateTriageTask(
    alertId: number,
    taskId: number,
    predictedAlertType: CaseType,
    predictedConfidence: number,
    predictedPriorityScore: number,
    priority: Priority,
    predictedTruePositive: boolean,
    userId: string,
  ): Promise<void> {
    try {
      this.loggerService.log(`Start - Updating alert ${alertId} and triage task ${taskId} with prediction`, TriageService.name);
      const updateDto = new UpdateAlertDTO();

      updateDto.predictionOutcome = predictedTruePositive ? 'TRUE_POSITIVE' : 'FALSE_POSITIVE';
      updateDto.priority = priority;
      updateDto.alertType = predictedAlertType;
      updateDto.confidencePer = predictedConfidence;
      updateDto.priority_score = predictedPriorityScore;
      // updateDto. = 'Updated alert data with outcome';

      const alert = await this.alertService.updateAlert(alertId, userId, updateDto);
      // this.commentService.addComment({ note: updateDto.note } as CreateCommentDto, userId);

      const task = await this.taskService.updateTask(
        taskId,
        {
          description: `Prediction applied: Type=${predictedAlertType}, Confidence=${predictedConfidence}`,
        },
        userId,
      );

      await this.audit.logAction({
        userId,
        operation: 'TRIAGE_ALERT_UPDATED',
        entityName: 'Alert & Task',
        actionPerformed: `Updated alert ${alertId} and triage task ${taskId} with prediction`,
        outcome: Outcome.SUCCESS,
      });

      await this.eventLogService.logEventAction({
        userId,
        operation: 'triage alert updated',
        entityName: 'Alert & Task',
        actionPerformed: `Updated alert ${alertId} and triage task ${taskId} with prediction`,
        outcome: Outcome.SUCCESS,
      });

      await this.taskHistoryService.logTaskHistoryAction({
        userId,
        operation: 'triage alert updated',
        entityName: 'Alert & Task',
        actionPerformed: `Updated alert ${alertId} and triage task ${taskId} with prediction`,
        case_id: task.case_id,
        task_id: taskId,
      });

      this.loggerService.log(`End - Updating alert ${alertId} and triage task ${taskId} with prediction`, TriageService.name);
    } catch (error) {
      this.loggerService.error(`Failed to update alert ${alertId} and triage task ${taskId}. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update alert and triage task');
    }
  }

  private async predictAlert(alert: IngestAlertDto): Promise<Prediction> {
    this.loggerService.log(`Start - AI Prediction`, TriageService.name);
    try {
      const extractedFeatures = await this.featureExtractionService.extractFeatures(alert);
      const predictedResult = await axios.post<AIPrediction>(this.configService.get<string>('AI_MODEL_ENDPOINT')!, extractedFeatures);
      const confidence = predictedResult.data.confidence * 100;

      return {
        priorityScore: predictedResult.data.priority,
        alertType: CaseType.FRAUD,
        confidence_per: confidence,
        isTruePositive: false,
      };
    } catch (error) {
      this.loggerService.error(`AI prediction failed: ${error.message}`, error.stack, TriageService.name);
      throw new InternalServerErrorException('AI prediction failed');
    }
  }
}
