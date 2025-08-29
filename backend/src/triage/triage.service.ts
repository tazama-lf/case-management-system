import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { CaseService } from '../case/case.service';
import { TaskService } from '../task/task.service';
import { CommentService } from '../comment/comment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Priority, CaseCreationType, CaseStatus, AlertType, Prisma, TaskStatus, CaseType } from '@prisma/client';
import { Outcome } from 'src/audit/types/outcome';
import { UpdateCaseDto } from 'src/case/dto/update-case.dto';

@Injectable()
export class TriageService {
  constructor(
    private readonly logger: LoggerService,
    private prisma: PrismaService,
    private audit: AuditLogService,
    private caseService: CaseService,
    private taskService: TaskService,
    private commentService: CommentService,
    private configService: ConfigService,
  ) {}

  async handleNewAlert(alert: SubmitAlertDto, userId: string, tenantId: string, source: string) {
    const txtp = alert.transaction.TxTp;

    try {
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', userId);
      const caseDetail: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: userId,
        caseOwnerUserId: systemUuid,
        status: CaseStatus.DRAFT_00,
        priority: Priority.NEW,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      };

      const createdCase = await this.caseService.createCase(caseDetail, userId);

      const newAlert = await this.prisma.alert.create({
        data: {
          tenant_id: tenantId,
          priority: Priority.NEW,
          source: source,
          txtp: txtp,
          message: String(alert.message),
          alert_data: JSON.parse(JSON.stringify(alert.report)),
          transaction: JSON.parse(JSON.stringify(alert.transaction)),
          network_map: JSON.parse(JSON.stringify(alert.networkMap)),
          confidence_per: 0,
          case_id: createdCase.case_id,
        },
      });
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CREATED',
        entityName: 'Alert',
        actionPerformed: `Created new alert ${newAlert.alert_id}`,
        outcome: Outcome.SUCCESS,
      });

      return newAlert;
    } catch (error) {
      this.logger.error(`Error creating alert :${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlertData(alertId: string, dto: UpdateAlertDto, userId: string, tenantId: string) {
    const existingAlert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    try {
      const updatedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
          alert_type: dto.alertType,
          prediction_outcome: dto.predictionOutcome,
        },
      });

      const createCommentDto = new CreateCommentDto();
      createCommentDto.caseId = updatedAlert.case_id;
      createCommentDto.note = dto.note;

      this.commentService.addComment(createCommentDto, userId);

      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined ? `, confidence_per=${dto.confidence_per}` : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : '') +
          (dto.alertType !== undefined ? `, alert_type=${dto.alertType}` : ''),
        outcome: Outcome.SUCCESS,
      });

      return updatedAlert;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId} : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Failed to update alert');
    }
  }

  async manualCloseAlert(alertId: string, closeAlertDto: CloseAlertDto, userId: string, tenantId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    try {
      const existingCase = await this.caseService.retrieveCase(alert?.case_id);

      if (
        existingCase.status === CaseStatus.CLOSED_CONFIRMED_82 ||
        existingCase.status === CaseStatus.CLOSED_REFUTED_81 ||
        existingCase.status === CaseStatus.CLOSED_INCONCLUSIVE_83
      ) {
        throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
      }

      const closedCase = await this.caseService.updateCase(existingCase.case_id, { status: closeAlertDto.status }, userId);

      const createCommentDto = new CreateCommentDto();
      createCommentDto.caseId = closedCase.case_id;
      createCommentDto.note = closeAlertDto.reason;

      this.commentService.addComment(createCommentDto, userId);

      await this.audit.logAction({
        userId,
        operation: 'ALERT_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Closed case for alert ${alertId} with reason: ${closeAlertDto.reason}  at ${new Date().toISOString()}`,
        outcome: Outcome.SUCCESS,
      });

      return closedCase;
    } catch (error) {
      this.logger.error(`Failed to close case for alert ${alertId} : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Failed to close alert');
    }
  }

  async getAlertsForUser(params: {
    tenantId: string;
    priority?: string;
    type?: string;
    alertType?: string;
    search?: string;
    source?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const { tenantId, priority, type, alertType, search, source, page, limit, sortBy, sortOrder } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    // Validate sortBy - allow sorting by any field in the select clause
    const validSortFields = ['alert_id', 'txtp', 'priority', 'confidence_per', 'alert_status', 'source', 'alert_type', 'created_at'];
    if (!validSortFields.includes(sortBy)) {
      throw new BadRequestException(`Invalid sortBy field: ${sortBy}. Must be one of ${validSortFields.join(', ')}`);
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be "asc" or "desc"');
    }

    const whereClause: Prisma.AlertWhereInput = {
      tenant_id: tenantId,
    };

    if (priority) {
      if (!Object.values(Priority).includes(priority.toUpperCase() as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
      whereClause.priority = priority.toUpperCase() as Priority;
    }

    if (alertType) {
      if (!Object.values(AlertType).includes(alertType.toUpperCase() as AlertType)) {
        throw new BadRequestException(`Invalid alertType: ${alertType}`);
      }
      whereClause.alert_type = alertType.toUpperCase() as AlertType;
    }

    if (type) {
      whereClause.txtp = type;
    }
    if (source) {
      whereClause.source = source;
    }

    if (search) {
      const searchConditions: Prisma.AlertWhereInput[] = [
        { txtp: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];

      // Very basic UUID check. A proper validation should be used in a real app.
      if (search.length === 36) {
        searchConditions.push({ alert_id: { equals: search } });
        searchConditions.push({ case_id: { equals: search } });
      }

      if (Object.values(Priority).includes(search.toUpperCase() as Priority)) {
        searchConditions.push({
          priority: { equals: search.toUpperCase() as Priority },
        });
      }
      if (Object.values(AlertType).includes(search.toUpperCase() as AlertType)) {
        searchConditions.push({
          alert_type: { equals: search.toUpperCase() as AlertType },
        });
      }
      whereClause.OR = searchConditions;
    }

    try {
      const alerts = await this.prisma.alert.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          alert_id: true,
          txtp: true,
          priority: true,
          confidence_per: true,
          source: true,
          alert_type: true,
          created_at: true,
        },
      });

      const totalCount = await this.prisma.alert.count({ where: whereClause });

      return {
        data: alerts,
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch alerts : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Unable to fetch alert list');
    }
  }

  async getAlertDetails(alertId: string, tenantId: string, userId: string) {
    try {
      const alert = await this.prisma.alert.findUnique({
        where: { alert_id: alertId },
        select: {
          alert_id: true,
          txtp: true,
          priority: true,
          confidence_per: true,
          created_at: true,
          source: true,
          message: true,
          alert_data: true,
          transaction: true,
          network_map: true,
          case_id: true,
          tenant_id: true,
        },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      if (alert.tenant_id !== tenantId) {
        throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
      }

      this.logger.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`, TriageService.name);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to fetch alert ${alertId} : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Unable to retrieve alert details');
    }
  }

  async getAlertActionHistory(alertId: string, tenantId: string, userId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

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

  async handleAITriage(alertId: string, caseId: string, dto: SubmitAlertDto, userId: string, tenantId: string) {
    try {
      const triageTask = await this.taskService.createTask(
        {
          caseId: caseId,
          assignedUserId: userId,
          status: TaskStatus.ASSIGNED_10,
          name: 'Triage Alert',
          description: `Created for triaging alert for case:${caseId}`,
        },
        userId,
      );

      const triageTaskId = triageTask.task_id;
      this.logger.log(`Task created: ${triageTaskId}`, TriageService.name);

      // Story 1G
      // If confidenceThreshold environment variable is not set, default to 100% → ensures low-confidence predictions always go to investigation.
      const confidenceThreshold = this.configService.get<number>('CONFIDENCE_THRESHOLD', 100);
      this.logger.log(`Using confidence threshold: ${confidenceThreshold} for alert ${alertId}`);

      // === Check if interdiction is enabled and determine if transaction occurred ===
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

      // Story 1A
      // === 1. Get AI prediction and update alert ===
      const prediction = await this.predictAlert();
      const { confidence_per: predictedConfidence, alertType: predictedAlertType, isTruePositive: predictedTruePositive } = prediction;
      this.logger.log(
        `AI prediction for alert ${alertId}: confidence=${predictedConfidence}, type=${predictedAlertType}, isTruePositive=${predictedTruePositive}`,
        TriageService.name,
      );
      await this.updateAlertAndUpdateTriageTask(alertId, triageTaskId, predictedAlertType, predictedConfidence, userId, tenantId);

      // Story 1F
      // === 2. Confidence below threshold → Investigation case ===
      if (predictedConfidence < confidenceThreshold) {
        this.logger.log(
          `Confidence ${predictedConfidence} below threshold ${confidenceThreshold} for alert ${alertId}. Creating investigation task for case ${caseId}.`,
        );
        return await this.createInvestigationTask(
          caseId,
          userId,
          triageTaskId,
          'Investigate Case as confidence is below threshold',
          'Triage complete - AI predicted confidence percentage below threshold manual investigation needed',
        );
      }

      // Story 1B
      // === 3. High confidence & False Positive → Auto-close as REFUTED ===
      if (predictedConfidence >= confidenceThreshold && !predictedTruePositive) {
        this.logger.log(
          `High confidence (${predictedConfidence} >= ${confidenceThreshold}) but False Positive. Auto-closing case ${caseId} as AUTOCLOSED_REFUTED.`,
        );
        return await this.autoCloseCase(
          caseId,
          CaseStatus.AUTOCLOSED_REFUTED_72,
          userId,
          triageTaskId,
          'Triage complete - AI predicted false positive (case auto-closed refuted)',
        );
      }
      // === 4. High confidence & True Positive ===
      if (predictedTruePositive) {
        // Story 1I
        if (predictedAlertType === AlertType.FRAUD_AND_AML) {
          this.logger.log(`Case predicted with both amdl and fraud creating child FRAUD & AML cases for case ${caseId}`);
          await this.taskService.updateTask(
            triageTaskId,
            {
              status: TaskStatus.COMPLETED_30,
              description: 'Triage complete - AI predicted true positive and case contains both fraud and aml',
            },
            userId,
          );
          await this.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, caseId, prediction);
          await this.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, caseId, prediction);
          return;
        }

        // Story 1E
        // If AML suspicion create case
        if (predictedAlertType === AlertType.AML) {
          this.logger.log(`True positive AML for alert ${alertId}. Creating AML investigation task for case: ${caseId}.`);
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Investigate Case for fraud',
            'Triage complete - AI predicted confidence percentage above threshold and true positive with case type aml',
            CaseType.AML,
          );
        }

        // If fraud and transaction occured create case else autoclose
        if (predictedAlertType === AlertType.FRAUD) {
          // Story 1C
          if (!transactionOccurred) {
            this.logger.log(
              `True positive FRAUD but interdiction indicates no transaction occurred for alert ${alertId}. Auto-closing as AUTOCLOSED_CONFIRMED.`,
            );
            return await this.autoCloseCase(
              caseId,
              CaseStatus.AUTOCLOSED_CONFIRMED_71,
              userId,
              triageTaskId,
              'Triage complete - AI predicted true positive (case auto-closed confirmed)',
            );
          }
          // Story 1D
          this.logger.log(`True positive FRAUD for alert ${alertId}. Creating FRAUD investigation task for case : ${caseId}.`);
          return await this.createInvestigationTask(
            caseId,
            userId,
            triageTaskId,
            'Investigate Case for fraud',
            'Triage complete - AI predicted confidence percentage above threshold and true positive with case type fraud and transaction occured',
            CaseType.FRAUD,
          );
        }
      }
    } catch (error) {
      this.logger.error(`AI triage failed for alert ${alertId}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'AI_TRIAGE_FAILED',
        entityName: 'Alert',
        actionPerformed: `AI triage failed for alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('AI triage process failed');
    }
  }

  private async autoCloseCase(caseId: string, status: CaseStatus, userId: string, taskId: string, customDescription?: string) {
    try {
      const [updatedCase, updatedTask] = await this.prisma.$transaction(async () => {
        const updatedTask = await this.taskService.updateTask(
          taskId,
          {
            status: TaskStatus.COMPLETED_30,
            description: customDescription ?? `Auto-closed case with status ${status}`,
          },
          userId,
        );

        const updateCaseDto = new UpdateCaseDto();
        updateCaseDto.status = status;
        const updatedCase = await this.caseService.updateCase(caseId, updateCaseDto, userId);

        return [updatedCase, updatedTask];
      });

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
    caseType: CaseType,
    userId: string,
    tenantId: string,
    parentCaseId: string,
    prediction?: any,
  ): Promise<any> {
    try {
      // Create new case
      const newCase = await this.caseService.createCase(
        {
          caseCreatorUserId: userId,
          caseOwnerUserId: userId,
          tenantId,
          priority: prediction?.priority ?? null,
          status: CaseStatus.READY_FOR_ASSIGNMENT_02,
          parentId: parentCaseId,
          caseType,
          caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
        },
        userId,
      );

      await this.audit.logAction({
        userId,
        operation: 'ADDITIONAL_CASE_CREATED',
        entityName: 'Case',
        actionPerformed: `Created ${caseType} case ${newCase.case_id} linked to parent ${parentCaseId}`,
        outcome: 'SUCCESS',
      });

      const task = await this.taskService.createTask(
        {
          caseId: newCase.case_id,
          assignedUserId: userId,
          status: TaskStatus.ASSIGNED_10,
          name: 'Investigate case',
          description: `Investigation task for ${caseType} case ${newCase.case_id}`,
        },
        userId,
      );

      await this.audit.logAction({
        userId,
        operation: 'INVESTIGATION_TASK_CREATED',
        entityName: 'Task',
        actionPerformed: `Created task ${task.task_id} for ${caseType} case ${newCase.case_id}`,
        outcome: 'SUCCESS',
      });

      return { caseId: newCase.case_id, taskId: task.task_id };
    } catch (error) {
      this.logger.error(`Failed to create ${caseType} case and task. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create ${caseType} case and task`);
    }
  }

  async createInvestigationTask(
    caseId: string,
    userId: string,
    taskId: string,
    investigateTaskDesc: string,
    triageTaskDesc: string,
    caseType?: CaseType,
  ): Promise<any> {
    try {
      // Complete triage task first
      await this.taskService.updateTask(taskId, { status: TaskStatus.COMPLETED_30, description: triageTaskDesc }, userId);

      // Create new investigation task
      const createdTask = await this.taskService.createTask(
        {
          caseId,
          assignedUserId: userId,
          status: TaskStatus.ASSIGNED_10,
          name: 'Investigate case',
          description: investigateTaskDesc ?? `Task to investigate: ${caseId}`,
        },
        userId,
      );

      // Update case status
      const updateCaseDto: Partial<UpdateCaseDto> = {
        status: CaseStatus.READY_FOR_ASSIGNMENT_02,
      };
      if (caseType) updateCaseDto.caseType = caseType;

      const updatedCase = await this.caseService.updateCase(caseId, updateCaseDto, userId);

      await this.audit.logAction({
        userId,
        operation: 'INVESTIGATION_TASK_CREATED',
        entityName: 'Task',
        actionPerformed: `Created task ${createdTask.task_id} for case ${caseId}`,
        outcome: 'SUCCESS',
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(`Failed to create investigation task for case ${caseId}. Error: ${error.message}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'INVESTIGATION_TASK_CREATION_FAILED',
        entityName: 'Task',
        actionPerformed: `Failed to create investigation task for case ${caseId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to create investigation task');
    }
  }

  private async updateAlertAndUpdateTriageTask(
    alertId: string,
    taskId: string,
    predictedAlertType: AlertType,
    predictedConfidence: number,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      const updateDto = new UpdateAlertDto();
      updateDto.alertType = predictedAlertType;
      updateDto.confidence_per = predictedConfidence;
      updateDto.note = 'Updated alert data with AI outcome';

      await this.updateAlertData(alertId, updateDto, userId, tenantId);

      await this.taskService.updateTask(
        taskId,
        {
          description: `AI prediction applied: Type=${predictedAlertType}, Confidence=${predictedConfidence}`,
        },
        userId,
      );

      await this.audit.logAction({
        userId,
        operation: 'TRIAGE_ALERT_UPDATED',
        entityName: 'Alert & Task',
        actionPerformed: `Updated alert ${alertId} and triage task ${taskId} with AI prediction`,
        outcome: 'SUCCESS',
      });

      this.logger.log(`Alert ${alertId} updated and triage task ${taskId} annotated successfully.`, this.constructor.name);
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId} and triage task ${taskId}. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update alert and triage task');
    }
  }

  private async predictAlert(): Promise<{
    priority: Priority;
    alertType: AlertType;
    confidence_per: number;
    isTruePositive: boolean; // true = real alarm, false = false alarm
  }> {
    // --- Placeholder AI Prediction ---
    return {
      priority: Priority.NEW,
      alertType: AlertType.FRAUD,
      confidence_per: 97,
      isTruePositive: true,
    };
  }
}
