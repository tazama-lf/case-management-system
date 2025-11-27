import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IngestAlertDto } from 'src/dtos';
import { ManualAlertUpdateDTO } from './dto/update-alert.dto';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { TaskService } from '../task/task.service';
import { CasePriorityUtil } from '../shared/utils/case-priority.util';
import { CommentService } from '../comment/comment.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Priority, CaseCreationType, CaseStatus, AlertType, CaseType, Prisma, TaskStatus } from '@prisma/client';
import { AIPrediction, Prediction } from './interfaces/Prediction';
import { CaseStatusChangedEvent } from '../events/domain-events';
import { FeatureExtractionService } from 'src/modules/feature-extraction/feature-extraction.service';
import axios from 'axios';
import { AlertService } from '../alert/alert.service';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { CaseRepository } from '../repository/case.repository';
import { AlertRepository } from '../repository/alert.repository';
import { FlowableService } from '../flowable/flowable.service';

@Injectable()
export class TriageService {
  private readonly closableStatuses: CaseStatus[] = [
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  ];

  constructor(
    private readonly logger: LoggerService,
    // private prisma: PrismaService,
    private readonly caseRepository: CaseRepository,
    private readonly alertRepository: AlertRepository,
    private readonly flowableService: FlowableService,
    private readonly alertService: AlertService,
    private audit: AuditLogService,
    private readonly caseCreationService: CaseCreationApprovalService,
    private taskService: TaskService,
    private commentService: CommentService,
    private configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly featureExtractionService: FeatureExtractionService,
  ) {}

  async handleManualTriage(alertId: string, updateAlertDto: ManualAlertUpdateDTO, userId: string, tenantId: string) {
    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
    if (triageType !== 'MANUAL') {
      throw new BadRequestException(`Cannot update alert ${alertId} when triageType is not MANUAL`);
    }

    try {
      const priorityScore = updateAlertDto.priorityScore ?? 0.33;
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

      // if (!existingCase) {
      //   throw new NotFoundException(`Case ${alert.case_id} not found`);
      // }

      const completeNewCaseTask = existingCase.tasks.find((t) => t.name === 'Complete New Case');
      // const completedTriageTask = completeNewCaseTasks.find((t) => t.status === TaskStatus.STATUS_30_COMPLETED);

      if (!completeNewCaseTask || completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
        throw new BadRequestException(`Triage Already Complete`);
      }

      // const completeNewCaseTask = completeNewCaseTasks.find((t) => t.status !== TaskStatus.STATUS_30_COMPLETED);

      // if (completeNewCaseTask && completeNewCaseTask.status !== TaskStatus.STATUS_30_COMPLETED) {
      await this.taskService.updateTask(
        completeNewCaseTask.task_id,
        { assignedUserId: userId, status: TaskStatus.STATUS_30_COMPLETED },
        userId,
      );

      // await this.flowableService.handleTaskAssigned({
      //   assignedUserId: userId,
      //   caseId: existingCase.case_id,
      //   taskId: completeNewCaseTask.task_id,
      //   taskName: completeNewCaseTask.name!,
      // });

      await this.commentService.addComment(
        { caseId: alert.case_id, taskId: completeNewCaseTask?.task_id, note: updateAlertDto.note } as CreateCommentDto,
        userId,
      );
      // } else {
      // this.logger.warn(`No active Complete New Case task found for case ${existingCase.case_id}`, TriageService.name);
      // }

      if (this.closableStatuses.includes(existingCase.status)) {
        throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
      }

      if (updateAlertDto?.status && this.closableStatuses.includes(updateAlertDto.status)) {
        await this.caseCreationService.updateCaseStatus(alert.case_id, updateAlertDto.status, userId);

        await this.flowableService.handleTaskCompleted({
          caseId: existingCase.case_id,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          taskName: completeNewCaseTask.name!,
          completionVariables: {
            autoCloseEligible: true,
            casePriority: alert.priority,
            readyForAssignment: false,
          },
        });

        await this.flowableService.handleTaskCompleted({
          caseId: existingCase.case_id,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          taskName: 'Auto Close',
          completionVariables: {
            autoCloseType: updateAlertDto.status,
            autoCloseReason: updateAlertDto.note,
          },
        });

        this.logger.log(
          `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Closed as ${updateAlertDto.status}`,
          TriageService.name,
        );
      } else {
        await this.caseCreationService.updateCaseStatus(
          alert.case_id,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          userId,
          priority,
          updateAlertDto.alertType as CaseType,
        );

        await this.flowableService.handleTaskCompleted({
          caseId: existingCase.case_id,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          taskName: completeNewCaseTask.name!,
          completionVariables: {
            autoCloseEligible: false,
            casePriority: alert.priority,
            readyForAssignment: true,
          },
        });

        if (updateAlertDto.alertType === AlertType.FRAUD_AND_AML) {
          await this.createCaseWithInvestigationTask(AlertType.AML, userId, tenantId, alert.case_id, priority);
          await this.createCaseWithInvestigationTask(AlertType.FRAUD, userId, tenantId, alert.case_id, priority);
        }

        this.logger.log(
          `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Sent to investigation`,
          TriageService.name,
        );
      }

      return alert;
    } catch (error) {
      this.logger.error(`Manual triage failed for alert ${alertId}: ${error.message}`, error.stack, TriageService.name);
      throw error;
    }
  }

  async getAlertDetails(alertId: string, tenantId: string, userId: string) {
    try {
      const alert = await this.alertRepository.getAlertById(alertId);

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      if (alert.tenant_id !== tenantId) {
        throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
      }

      this.logger.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`, TriageService.name);

      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to fetch alert ${alertId}: ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Unable to retrieve alert details');
    }
  }

  async getAlertActionHistory(alertId: string, tenantId: string, userId: string) {
    const alert = await this.alertRepository.getAlertById(alertId);

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    const history = await this.audit.getActionHistoryForAlert(alertId);
    return {
      alertId,
      tenantId,
      userId,
      history,
    };
  }

  async handleAITriage(alertId: string, caseId: string, dto: IngestAlertDto, userId: string, tenantId: string) {
    try {
      const triageTask = await this.taskService.createTask(
        {
          caseId: caseId,
          assignedUserId: userId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          name: 'Triage Alert',
          description: `Created for triaging alert for case:${caseId}`,
          candidateGroup: 'Investigator',
        },
        userId,
      );

      const triageTaskId = triageTask.task_id;
      this.logger.log(`Task created: ${triageTaskId}`, TriageService.name);

      const confidenceThreshold = this.configService.get<number>('CONFIDENCE_THRESHOLD', 100);
      this.logger.log(`Using confidence threshold: ${confidenceThreshold} for alert ${alertId}`);

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

      this.logger.log(
        `AI prediction for alert ${alertId}: confidence=${predictedConfidence}, type=${predictedAlertType}, isTruePositive=${predictedTruePositive}`,
        TriageService.name,
      );

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
        tenantId,
      );

      if (predictedConfidence < confidenceThreshold) {
        this.logger.log(
          `Confidence ${predictedConfidence} below threshold ${confidenceThreshold} for alert ${alertId}. Creating investigation task for case ${caseId}.`,
        );
        return await this.createInvestigationTask(
          caseId,
          userId,
          triageTaskId,
          'Investigate Case as confidence is below threshold',
          'Triage complete - confidence percentage below threshold manual investigation needed',
          priority,
          predictedAlertType,
        );
      }

      if (predictedConfidence >= confidenceThreshold && !predictedTruePositive) {
        this.logger.log(
          `High confidence (${predictedConfidence} >= ${confidenceThreshold}) but False Positive. Auto-closing case ${caseId} as AUTOCLOSED_REFUTED.`,
        );
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
        if (predictedAlertType === AlertType.FRAUD_AND_AML) {
          this.logger.log(`Case predicted with both aml and fraud creating child FRAUD & AML cases for case ${caseId}`);
          await this.taskService.updateTask(
            triageTaskId,
            {
              status: TaskStatus.STATUS_30_COMPLETED,
              description: 'Triage complete - true positive and case contains both fraud and aml',
            },
            userId,
          );
          // await this.prisma.case.update({
          //   where: { case_id: caseId },
          //   data: {
          //     case_type: predictedAlertType,
          //     status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          //   },
          // });
          await this.caseRepository.updateCase(caseId, {
            case_type: predictedAlertType,
            status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          });
          await this.createCaseWithInvestigationTask(AlertType.FRAUD, userId, tenantId, caseId, priority);
          await this.createCaseWithInvestigationTask(AlertType.AML, userId, tenantId, caseId, priority);
          return;
        }

        if (predictedAlertType === AlertType.AML) {
          this.logger.log(`True positive AML for alert ${alertId}. Creating AML investigation task for case: ${caseId}.`);
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Investigate Case for AML',
            'Triage complete - confidence percentage above threshold and true positive with case type aml',
            priority,
            predictedAlertType,
          );
        }

        if (predictedAlertType === AlertType.FRAUD) {
          if (!transactionOccurred) {
            this.logger.log(
              `True positive FRAUD but interdiction indicates no transaction occurred for alert ${alertId}. Auto-closing as AUTOCLOSED_CONFIRMED.`,
            );
            return await this.autoCloseCase(
              caseId,
              CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
              userId,
              triageTaskId,
              predictedAlertType,
              'Triage complete - true positive (case auto-closed confirmed)',
            );
          }

          this.logger.log(`True positive FRAUD for alert ${alertId}. Creating FRAUD investigation task for case: ${caseId}.`);
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Investigate Case for fraud',
            'Triage complete - confidence percentage above threshold and true positive with case type fraud and transaction occured',
            priority,
            predictedAlertType,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Triage failed for alert ${alertId}`, error.stack);
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
    caseId: string,
    status: CaseStatus,
    userId: string,
    taskId: string,
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

      // await this.caseCreationService.updateCaseStatus(caseId, status, userId);
      const updatedCase = await this.caseCreationService.updateCaseStatus(caseId, status, userId, undefined, caseType);

      // const updatedCase = await this.prisma.case.findUnique({
      // where: { case_id: caseId },
      // });

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

      return { updatedCase, updatedTask };
    } catch (error) {
      this.logger.error(`Auto-close failed for case ${caseId}`, error);
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

  async createCaseWithInvestigationTask(
    alertType: AlertType,
    userId: string,
    tenantId: string,
    parentCaseId: string,
    priority: Priority,
  ): Promise<unknown> {
    try {
      const newCase = await this.caseCreationService.createCase(
        {
          caseCreatorUserId: userId,
          caseOwnerUserId: userId,
          tenantId,
          priority: priority,
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          parentId: parentCaseId,
          caseType: alertType as CaseType,
          caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
        },
        userId,
      );

      await this.audit.logAction({
        userId,
        operation: 'ADDITIONAL_CASE_CREATED',
        entityName: 'Case',
        actionPerformed: `Created ${alertType} child case ${newCase.case_id} linked to parent ${parentCaseId}. BPMN will create investigation task.`,
        outcome: 'SUCCESS',
      });

      this.logger.log(
        `Child case ${newCase.case_id} (${alertType}) created. BPMN workflow will create investigation task.`,
        TriageService.name,
      );

      return {
        caseId: newCase.case_id,
        message: 'Child case created, BPMN will create investigation task',
      };
    } catch (error) {
      this.logger.error(`Failed to create ${alertType} case. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create ${alertType} case`);
    }
  }

  async createInvestigationTask(
    caseId: string,
    userId: string,
    taskId: string,
    investigateTaskDesc: string,
    triageTaskDesc: string,
    priority: Priority,
    alertType?: AlertType,
  ): Promise<unknown> {
    try {
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

      // const updatedCase = await this.prisma.case.findUnique({
      //   where: { case_id: caseId },
      // });

      this.logger.log(`AI triage completed for case ${caseId}. BPMN will create investigation task automatically.`, TriageService.name);

      return {
        case: updatedCase,
        message: 'Triage completed. Investigation task will be created by workflow engine.',
      };
    } catch (error) {
      this.logger.error(`Failed to complete triage for case ${caseId}. Error: ${error.message}`, error.stack);
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
    alertId: string,
    taskId: string,
    predictedAlertType: AlertType,
    predictedConfidence: number,
    predictedPriorityScore: number,
    priority: Priority,
    predictedTruePositive: boolean,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      const updateDto = new ManualAlertUpdateDTO();

      updateDto.predictionOutcome = predictedTruePositive ? 'TRUE_POSITIVE' : 'FALSE_POSITIVE';
      updateDto.priority = priority;
      updateDto.alertType = predictedAlertType;
      updateDto.confidence_per = predictedConfidence;
      updateDto.priorityScore = predictedPriorityScore;
      updateDto.note = 'Updated alert data with outcome';

      const alert = await this.alertService.updateAlert(alertId, userId, updateDto);
      this.commentService.addComment({ note: updateDto.note } as CreateCommentDto, userId);

      await this.taskService.updateTask(
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
        outcome: 'SUCCESS',
      });

      this.logger.log(`Alert ${alertId} updated and triage task ${taskId} annotated successfully.`, TriageService.name);
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId} and triage task ${taskId}. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update alert and triage task');
    }
  }

  public async predictAlert(alert: IngestAlertDto): Promise<Prediction> {
    {
      const extractedFeatures = await this.featureExtractionService.extractFeatures(alert);
      const predictedResult = await axios.post<AIPrediction>(this.configService.get<string>('AI_MODEL_ENDPOINT')!, extractedFeatures);
      const confidence = predictedResult.data.confidence * 100;
      this.logger.log(`Prediction for alert ${alert.report.evaluationID}: ${JSON.stringify(predictedResult.data)}`, TriageService.name);

      return {
        priorityScore: predictedResult.data.priority,
        alertType: AlertType.FRAUD_AND_AML,
        confidence_per: confidence,
        isTruePositive: true,
      };
    }
  }
}
