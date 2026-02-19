import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TaskService } from '../task/task.service';
import { CasePriorityUtil } from '../shared/utils/case-priority.util';
import { Priority, CaseStatus, CaseType, Prisma, TaskStatus, CaseCreationType } from '@prisma/client-cms';
import { AIPrediction, Prediction } from '../../utils/interfaces/Prediction';
import { CaseStatusChangedEvent } from '../events/domain-events';
import { FeatureExtractionService } from 'src/modules/feature-extraction/feature-extraction.service';
import axios from 'axios';
import { AlertService } from '../alert/alert.service';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { CaseRepository } from '../repository/case.repository';
import { AlertRepository } from '../repository/alert.repository';
import { FlowableService } from '../flowable/flowable.service';
import { Outcome } from '../../utils/types/outcome';
import { ManualAlertUpdateDTO, IngestAlertDto } from '../alert/dto';
import { UpdateAlertDTO } from '../alert/dto';
import { CaseCreationService } from '../case/services/case-creation.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { PrismaService } from 'prisma/prisma.service';
import { AlertNavigatorDto, TypologyDto, RuleDto, BlockStatusDto, RelatedLinksDto } from './dto/alert-navigator.dto';
import { LinkDto, TransactionDetailDto, ChargeDto, CreditorDto, DebtorDto } from './dto/transaction-detail.dto';
import { TaskRepository } from '../repository/task.repository';
import { CommentRepository } from '../repository/comment.repository';

@Injectable()
export class TriageService {
  private readonly closableStatuses: CaseStatus[] = [
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  ];

  constructor(
    private readonly logger: LoggerService,
    private readonly alertRepository: AlertRepository,
    private readonly taskRepository: TaskRepository,
    private readonly commentRepository: CommentRepository,
    private readonly caseRepository: CaseRepository,
    private readonly flowableService: FlowableService,
    private readonly alertService: AlertService,
    private readonly caseCreationService: CaseCreationApprovalService,
    private taskService: TaskService,
    private configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly featureExtractionService: FeatureExtractionService,
    private readonly caseCreateService: CaseCreationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly prisma: PrismaService
  ) { }

  async getAlertNavigator(alertId: number, tenantId: string, userId: string): Promise<AlertNavigatorDto> {
    this.logger.log(`Fetching alert navigator for alertId: ${alertId}, tenantId: ${tenantId}, userId: ${userId}`, TriageService.name);

    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId, tenant_id: tenantId },
    });
    if (!alert) {
      this.logger.warn(`Alert not found: ${alertId} for tenant: ${tenantId}`, TriageService.name);
      throw new NotFoundException('Alert not found');
    }

    this.logger.log(`Alert found: ${alertId}, processing data`, TriageService.name);

    const alertReport = (alert.alert_data as any) || {};
    const transactionData = (alert.transaction as any) || {};
    const networkMapData = (alert.network_map as any) || {};
    const tadpReport = alertReport || {};

    const typologies: TypologyDto[] = [];
    const rules: RuleDto[] = [];

    const typologyResults = tadpReport?.tadpResult?.typologyResult || [];
    this.logger.log(`Processing ${typologyResults.length} typologies`, TriageService.name);

    for (const typology of typologyResults) {
      typologies.push({
        id: typology.id,
        score: typology.result ?? 0,
        threshold: typology.workflow?.alertThreshold ?? 0,
        rules:
          typology.ruleResults?.map((rule) => ({
            id: rule.id,
            weight: rule.wght ?? 0,
          })) || [],
      });
      if (Array.isArray(typology.ruleResults)) {
        for (const rule of typology.ruleResults) {
          rules.push({
            id: rule.id,
            weight: rule.wght ?? 0,
          });
        }
      }
    }

    this.logger.log(`Extracted ${typologies.length} typologies and ${rules.length} rules`, TriageService.name);

    const blockStatusValue = alert.block_status ?? alertReport?.block_status;
    const blockReasonValue = alert.block_reason ?? alertReport?.block_reason;

    const blockStatus: BlockStatusDto | null =
      blockStatusValue || blockReasonValue
        ? {
          status: blockStatusValue ?? '',
          reason: blockReasonValue ?? '',
        }
        : null;

    const transactionId = transactionData?.FIToFIPmtSts?.GrpHdr?.MsgId ?? '';
    const amount = {
      value: transactionData?.FIToFIPmtSts?.TxInfAndSts?.Amt?.Amt ?? 0,
      currency: transactionData?.FIToFIPmtSts?.TxInfAndSts?.Amt?.Ccy ?? '',
    };
    const relatedLinks: RelatedLinksDto = {
      transactionDetail: `/triage/transaction-detail/${transactionId}`,
      transactionHistory: `/api/v1/transactions/${transactionId}/history`,
      conditionsView: `/api/v1/alerts/${alertId}/conditions`,
      alertHistory: `/api/v1/triage/alerts/${alertId}/action-history`,
      jupyterLab: `/notebooks/transaction-viz.ipynb?alertId=${alertId}`,
    };

    const links: LinkDto[] = [
      {
        rel: 'alert-navigator',
        href: `/api/v1/triage/alerts/${alert.alert_id}/navigator`,
      },
      {
        rel: 'transaction-history',
        href: `/api/v1/transactions/${transactionId}/history`,
      },
    ];

    this.logger.log(`Alert navigator data prepared for alertId: ${alertId}`, TriageService.name);

    return {
      alertId: alert.alert_id,
      transactionId,
      timestamp: transactionData?.FIToFIPmtSts?.GrpHdr?.CreDtTm ?? '',
      transactionType: alert.txtp ?? '',
      amount,
      status: blockStatusValue ?? '',
      reason: alert.message ?? '',
      blockReason: blockReasonValue ?? '',
      typologies,
      rules,
      blockStatus,
      relatedLinks,
      links,
    };
  }

  async getTransactionDetail(transactionId: string, tenantId: string, userId: string): Promise<TransactionDetailDto> {
    this.logger.log(
      `Fetching transaction detail for transactionId: ${transactionId}, tenantId: ${tenantId}, userId: ${userId}`,
      TriageService.name,
    );

    const alert = await this.prisma.alert.findFirst({
      where: {
        tenant_id: tenantId,
        transaction: {
          path: ['FIToFIPmtSts', 'GrpHdr', 'MsgId'],
          equals: transactionId,
        },
      },
    });

    if (!alert) {
      this.logger.warn(`Transaction not found: ${transactionId} for tenant: ${tenantId}`, TriageService.name);
      throw new NotFoundException('Transaction not found');
    }

    const transactionData = (alert.transaction as any) || {};
    const txInfAndSts = transactionData?.FIToFIPmtSts?.TxInfAndSts;

    const debtor: DebtorDto = {
      name: txInfAndSts?.Dbtr?.Nm,
      account: {
        iban: txInfAndSts?.Dbtr?.Acct?.Id?.IBAN,
        type: txInfAndSts?.Dbtr?.Acct?.Tp,
      },
      bank: txInfAndSts?.Dbtr?.Agt?.FinInstnId?.Nm,
      swiftCode: txInfAndSts?.Dbtr?.Agt?.FinInstnId?.BICFI,
      address: txInfAndSts?.Dbtr?.Agt?.FinInstnId?.PstlAdr
        ? `${txInfAndSts.Dbtr.Agt.FinInstnId.PstlAdr.StrtNm}, ${txInfAndSts.Dbtr.Agt.FinInstnId.PstlAdr.TwnNm}, ${txInfAndSts.Dbtr.Agt.FinInstnId.PstlAdr.Ctry} ${txInfAndSts.Dbtr.Agt.FinInstnId.PstlAdr.PstCd}`
        : undefined,
      accountType: txInfAndSts?.Dbtr?.Acct?.Tp,
    };

    const creditor: CreditorDto = {
      name: txInfAndSts?.Cdtr?.Nm,
      account: {
        iban: txInfAndSts?.Cdtr?.Acct?.Id?.IBAN,
        type: txInfAndSts?.Cdtr?.Acct?.Tp,
      },
      bank: txInfAndSts?.Cdtr?.Agt?.FinInstnId?.Nm,
      swiftCode: txInfAndSts?.Cdtr?.Agt?.FinInstnId?.BICFI,
      address: txInfAndSts?.Cdtr?.Agt?.FinInstnId?.PstlAdr
        ? `${txInfAndSts.Cdtr.Agt.FinInstnId.PstlAdr.StrtNm}, ${txInfAndSts.Cdtr.Agt.FinInstnId.PstlAdr.TwnNm}, ${txInfAndSts.Cdtr.Agt.FinInstnId.PstlAdr.Ctry} ${txInfAndSts.Cdtr.Agt.FinInstnId.PstlAdr.PstCd}`
        : undefined,
      accountType: txInfAndSts?.Cdtr?.Acct?.Tp,
    };

    // Amount and currency
    const amount = txInfAndSts?.Amt?.Amt || 0;
    const currency = txInfAndSts?.Amt?.Ccy || 'USD';
    const exchangeRate = 0.79; // Example rate for USD to GBP
    const convertedAmount = Math.round(amount * exchangeRate); // Rounded to nearest
    const convertedCurrency = 'GBP';

    // Charges
    const charges: ChargeDto[] = (txInfAndSts?.ChrgsInf || []).map((charge: any) => ({
      amount: charge.Amt?.Amt || 0,
      currency: charge.Amt?.Ccy || 'USD',
      agent: {
        memberId: charge.Agt?.FinInstnId?.ClrSysMmbId?.MmbId || '',
      },
    }));

    const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0);

    // Settlement details
    const settlementDate = txInfAndSts?.SttlmInf?.SttlmDt;
    const reference = txInfAndSts?.SttlmInf?.Ref;
    const purpose = txInfAndSts?.SttlmInf?.Purp;

    // Links
    const links: LinkDto[] = [
      {
        rel: 'alert-navigator',
        href: `/api/v1/triage/alerts/${alert.alert_id}/navigator`,
      },
      {
        rel: 'transaction-history',
        href: `/api/v1/transactions/${transactionId}/history`,
      },
    ];

    // Visualization URL - placeholder, assuming JupyterLab endpoint
    const visualizationUrl = `${this.configService.get('JUPYTERLAB_URL', 'http://localhost:8888')}/notebooks/transaction-viz.ipynb?transactionId=${transactionId}`;

    this.logger.log(`Transaction detail prepared for transactionId: ${transactionId}`, TriageService.name);

    return {
      transactionOverview: {
        transactionId,
        transactionType: alert.txtp || '',
        timestamp: transactionData?.FIToFIPmtSts?.GrpHdr?.CreDtTm || '',
      },
      transactionFlow: {
        debtor: {
          name: debtor.name || '',
          account: debtor.account || { iban: '' },
          bank: debtor.bank || '',
        },
        amount: {
          amount,
        },
        creditor: {
          name: creditor.name || '',
          account: creditor.account || { iban: '' },
          bankName: creditor.bank || '',
        },
      },
      debtorProfile: debtor,
      creditorProfile: creditor,
      amountAndCurrency: [
        {
          originalAmount: amount,
          exchangeRate,
          convertedAmount,
        },
        {
          senderCharges: charges.length > 0 ? [charges[0]] : [],
          intermediaryCharges: charges.length > 1 ? [charges[1]] : [],
          receiverCharges: charges.length > 2 ? [charges[2]] : [],
        },
        {
          totalCharges,
        },
      ],
      settlementDetails: {
        settlementDate,
        reference,
        purpose,
      },
      links,
      visualizationUrl,
    };
  }

  async handleManualTriage(alertId: number, updateAlertDto: ManualAlertUpdateDTO, userId: string, tenantId: string) {
    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
    if (triageType !== 'MANUAL') {
      throw new BadRequestException(`Cannot update alert ${alertId} when triageType is not MANUAL`);
    }

    try {
      const priorityScore = updateAlertDto.priorityScore ?? 0.33;
      const priority = this.casePriorityUtil.determinePriority(priorityScore);
      updateAlertDto.priority = priority;
      const transactionResult = await this.alertRepository.transaction(async (tx) => {
        const alert = await this.alertService.updateAlert(alertId, userId, updateAlertDto, tx);
        if (!alert.case_id) {
          throw new InternalServerErrorException('Alert case_id is missing.');
        }

      const existingCase = await this.caseRepository.findCaseById(alert.case_id,tenantId);

      const completeNewCaseTask = existingCase.tasks.find((t) => t.name === 'Complete New Case');

      if (!completeNewCaseTask || completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
        throw new BadRequestException(`Triage Already Complete`);
      }

      await this.taskService.updateTask(
        completeNewCaseTask.task_id,
        { assignedUserId: userId, status: TaskStatus.STATUS_30_COMPLETED },
        userId,
        tenantId
      );

        await this.commentRepository.createComment(
          userId,
          {
            caseId: alert.case_id,
            taskId: completeNewCaseTask?.task_id,
            tenantId: tenantId,
            note: updateAlertDto.note,
          } as CreateCommentDto,
          tx,
        );

        if (this.closableStatuses.includes(existingCase.status)) {
          throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
        }

      if (updateAlertDto?.status && this.closableStatuses.includes(updateAlertDto.status)) {
        await this.caseCreationService.updateCaseStatus(alert.case_id, updateAlertDto.status, userId, tenantId);

          await this.flowableService.handleTaskCompleted({
            caseId: existingCase.case_id,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            taskName: completeNewCaseTask.name!,
            completionVariables: {
              autoCloseEligible: true,
              caseType: updateAlertDto.alertType,
              casePriority: alert.priority,
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

        await this.caseCreationService.updateCaseStatus(
          alert.case_id,
          updateAlertDto.status,
          userId,
          tenantId,
          priority,
          updateAlertDto.alertType as CaseType,
        );

        this.logger.log(
          `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Closed as ${updateAlertDto.status}`,
          TriageService.name,
        );
      } else {
        if (alert.alert_type)
          await this.caseCreationService.updateCaseStatus(
            alert.case_id,
            CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            userId,
            tenantId,
            priority,
            updateAlertDto.alertType as CaseType,
          );

          if (alert.alert_type === CaseType.FRAUD_AND_AML) {
            await this.caseCreateService.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, alert.case_id, priority);
            await this.caseCreateService.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, alert.case_id, priority);
          }

          await this.flowableService.handleTaskCompleted({
            caseId: existingCase.case_id,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            taskName: completeNewCaseTask.name!,
            completionVariables: {
              autoCloseEligible: false,
              caseType: updateAlertDto.alertType,
              casePriority: alert.priority,
            },
          });
        }
        return { alert };
      });

      this.logger.log(`End - handleManualTriage`, TriageService.name);
      return transactionResult.alert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Manual triage failed for alert ${alertId}: ${errorMessage}`, errorStack, TriageService.name);
      throw error;
    }
  }

  async handleAITriage(alertId: number, caseId: number, dto: IngestAlertDto, userId: string, tenantId: string) {
    this.logger.log(`Start - AI Triage for alert ${alertId}`, TriageService.name);
    try {
      const triageTask = await this.taskService.createTask(
        {
          caseId: caseId,
          assignedUserId: userId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          name: 'Complete New Case',
          description: `Created for triaging alert for case:${caseId}`,
          candidateGroup: 'investigator',
        },
        userId,
        tenantId,
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
        tenantId,
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
          },
        });
        return await this.createInvestigationTask(
          caseId,
          userId,
          triageTaskId,
          'Triage complete - confidence percentage below threshold manual investigation needed',
          priority,
          tenantId,
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
          },
        });
        return await this.autoCloseCase(
          caseId,
          CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
          userId,
          triageTaskId,
          tenantId,
          predictedAlertType,
          'Triage complete - false positive (case auto-closed refuted)',
        );
      }

      if (predictedTruePositive) {
        if (predictedAlertType === CaseType.FRAUD_AND_AML) {
          this.logger.log(`Case predicted with both aml and fraud creating child FRAUD & AML cases for case ${caseId}`);
          await this.taskService.updateTask(
            triageTaskId,
            {
              status: TaskStatus.STATUS_30_COMPLETED,
            },
            userId,
            tenantId,
          );
          await this.flowableService.handleTaskCompleted({
            caseId: caseId,
            taskName: triageTask.name!,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              autoCloseEligible: false,
              caseType: predictedAlertType,
              casePriority: priority,
            },
          });

          await this.caseCreationService.updateCaseStatus(
            caseId,
            CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            userId,
            tenantId,
            priority,
            predictedAlertType,
          );
          await this.caseCreateService.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, caseId, priority);
          await this.caseCreateService.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, caseId, priority);

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
            },
          });
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Triage complete - confidence percentage above threshold and true positive with case type aml',
            priority,
            tenantId,
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
              },
            });
            return await this.autoCloseCase(
              caseId,
              CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
              userId,
              triageTaskId,
              tenantId,
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
            },
          });
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Triage complete - confidence percentage above threshold and true positive with case type fraud and transaction occured',
            priority,
            tenantId,
            predictedAlertType,
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Triage failed for alert ${alertId}: ${errorMessage}`, errorStack, TriageService.name);
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'AI_TRIAGE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Triage failed for alert ${alertId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });
      throw new InternalServerErrorException('Triage process failed');
    }
  }

  private async autoCloseCase(
    caseId: number,
    status: CaseStatus,
    userId: string,
    taskId: number,
    tenantId: string,
    caseType?: CaseType,
    customDescription?: string,
  ) {
    try {
      const existingCase = await this.caseRepository.findCaseById(caseId, tenantId);

      if (!existingCase) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const updatedTask = await this.taskService.updateTask(
        taskId,
        {
          status: TaskStatus.STATUS_30_COMPLETED,
        },
        userId,
        tenantId,
      );

      const updatedCase = await this.caseCreationService.updateCaseStatus(caseId, status, userId, tenantId, undefined, caseType);

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(caseId, status, customDescription || `Case automatically closed with status ${status}`),
      );

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'CASE_AUTO_CLOSED',
          entityName: 'Case',
          actionPerformed: `Auto-closed case ${caseId} with status: ${status}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        existingCase.tenant_id,
      );

      return { updatedCase, updatedTask };
    } catch (error) {
      this.logger.error(`Auto-close failed for case ${caseId}`, error);
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'CASE_AUTO_CLOSE_FAILED',
        entityName: 'Case',
        actionPerformed: `Failed to auto close case ${caseId}`,
        outcome: Outcome.FAILURE,
      });
      throw new InternalServerErrorException('Failed to auto close case');
    }
  }

  async createInvestigationTask(
    caseId: number,
    userId: string,
    taskId: number,
    triageTaskDesc: string,
    priority: Priority,
    tenantId: string,
    alertType?: CaseType,
  ): Promise<unknown> {
    try {
      this.logger.log(`Start - AI triage completed for case ${caseId}`, TriageService.name);
      const existingCase = await this.caseRepository.findCaseById(caseId, tenantId);
      if (!existingCase) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      await this.taskService.updateTask(taskId, { status: TaskStatus.STATUS_30_COMPLETED}, userId, tenantId);

      const updatedCase = await this.caseCreationService.updateCaseStatus(
        caseId,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        userId,
        tenantId,
        priority,
        alertType as CaseType,
      );

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'INVESTIGATION_TASK_TRIGGERED',
          entityName: 'Task',
          actionPerformed: `AI triage completed for case ${caseId}. BPMN will create investigation task.`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        existingCase.tenant_id,
        taskId,
      );

      this.logger.log(`End - AI triage completed for case ${caseId}`, TriageService.name);

      return {
        case: updatedCase,
        message: 'Triage completed. Investigation task will be created by workflow engine.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to complete triage for case ${caseId}. Error: ${errorMessage}`, errorStack, TriageService.name);
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'INVESTIGATION_TASK_TRIGGER_FAILED',
        entityName: 'Task',
        actionPerformed: `Failed to complete triage for case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
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
    tenantId: string,
  ): Promise<void> {
    try {
      this.logger.log(`Start - Updating alert ${alertId} and triage task ${taskId} with prediction`, TriageService.name);
      const updateDto = new UpdateAlertDTO();

      updateDto.predictionOutcome = predictedTruePositive ? 'TRUE_POSITIVE' : 'FALSE_POSITIVE';
      updateDto.priority = priority;
      updateDto.alertType = predictedAlertType;
      updateDto.confidencePer = predictedConfidence;
      updateDto.priority_score = predictedPriorityScore;

      const alert = await this.alertService.updateAlert(alertId, userId, updateDto);
      // this.commentService.addComment({ note: updateDto.note } as CreateCommentDto, userId);

      const task = await this.taskService.updateTask(
        taskId,
        {
          investigationNotes: `Prediction applied: Type=${predictedAlertType}, Confidence=${predictedConfidence}`,
        },
        userId,
        tenantId,
      );

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'TRIAGE_ALERT_UPDATED',
          entityName: 'Alert & Task',
          actionPerformed: `Updated alert ${alertId} and triage task ${taskId} with prediction`,
          outcome: Outcome.SUCCESS,
        },
        task.case_id,
        tenantId,
        taskId,
      );

      this.logger.log(`End - Updating alert ${alertId} and triage task ${taskId} with prediction`, TriageService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to update alert ${alertId} and triage task ${taskId}. Error: ${errorMessage}`,
        errorStack,
        TriageService.name,
      );
      throw new InternalServerErrorException('Failed to update alert and triage task');
    }
  }

  private async predictAlert(alert: IngestAlertDto): Promise<Prediction> {
    this.logger.log(`Start - AI Prediction`, TriageService.name);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`AI prediction failed: ${errorMessage}`, errorStack, TriageService.name);
      throw new InternalServerErrorException('AI prediction failed');
    }
  }
}
