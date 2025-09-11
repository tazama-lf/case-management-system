import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
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
import { AlertMessageDto } from 'src/nats/dto/AlertMessageDto.dto';
import { ManualTriageDto } from './dto/manual-triage.dto';
import { Prediction } from './types/Prediction';

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

  async processIncomingAlert(req: AlertMessageDto, userId: string, tenantId: string) {
    const submitAlertDto: SubmitAlertDto = {
      message: req.message,
      report: req.report,
      transaction: req.transaction,
      networkMap: req.networkMap,
    };

    const alert = await this.handleNewAlert(submitAlertDto, userId, tenantId, 'NATS');
    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();

    switch (triageType) {
      case 'AI': {
        this.logger.log(`AI Triage enabled for alert: ${alert.alert_id}`, TriageService.name);
        await this.handleAITriage(alert.alert_id, alert.case_id, submitAlertDto, userId, tenantId);
        break;
      }

      case 'MANUAL': {
        this.logger.log(`Manual Triage enabled for alert: ${alert.alert_id}`, TriageService.name);
        await this.taskService.createTask(
          {
            caseId: alert.case_id,
            status: TaskStatus.UNASSIGNED_01,
            name: 'Triage Alert',
            description: 'Task for Manual Triage',
          },
          userId,
        );
        break;
      }

      case 'DISABLED':
      default: {
        this.logger.log(`Triage disabled, creating investigation task for alert: ${alert.alert_id}`, TriageService.name);

        await this.taskService.createTask(
          {
            caseId: alert.case_id,
            status: TaskStatus.UNASSIGNED_01,
            name: 'Investigate Case',
            description: `Investigate case: ${alert.case_id}`,
          },
          userId,
        );
        const updateCaseDto: Partial<UpdateCaseDto> = {
          status: CaseStatus.READY_FOR_ASSIGNMENT_02,
        };
        await this.caseService.updateCase(alert.case_id, updateCaseDto, userId);
        break;
      }
    }
  }

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

  async handleManualTriage(alertId: string, manualTriageDto: ManualTriageDto, userId: string, tenantId: string) {
    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
    if (triageType !== 'MANUAL') {
      throw new BadRequestException(`Cannot update alert ${alertId} when triageType is not MANUAL`);
    }

    try {
      const priorityScore = manualTriageDto.priorityScore ?? 0.33;
      const priority = this.determinePriority(priorityScore);
      manualTriageDto.priority = priority;

      const alertWithCase = await this.prisma.alert.findUnique({
        where: { alert_id: alertId },
        include: { case: true },
      });

      if (!alertWithCase || !alertWithCase.case) {
        throw new BadRequestException(`No case found for alert ${alertId}`);
      }

      const existingCase = alertWithCase.case;

      const triageTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
      const allTriageTasks = triageTasks.filter((t) => t.name === 'Triage Alert');

      // Check if task already   completed triage task
      const completedTriageTask = allTriageTasks.find((t) => t.status === TaskStatus.COMPLETED_30);
      if (completedTriageTask) {
        throw new BadRequestException(`Cannot update triage task ${completedTriageTask.task_id} as it is already completed`);
      }

      // Find the active (non-completed) triage task
      const triageTask = allTriageTasks.find((t) => t.status !== TaskStatus.COMPLETED_30);

      if (triageTask) {
        this.logger.log(
          `Found triage task ${triageTask.task_id} with assigned_user_id: ${triageTask.assigned_user_id}, current userId: ${userId}`,
          TriageService.name,
        );

        // Auto-assign the task to the current user if not assigned or assigned to someone else
        if (!triageTask.assigned_user_id || triageTask.assigned_user_id !== userId) {
          this.logger.log(`Auto-assigning triage task ${triageTask.task_id} to user ${userId}`, TriageService.name);
          await this.taskService.updateTask(triageTask.task_id, { assignedUserId: userId }, userId);
        } else {
          this.logger.log(`Triage task ${triageTask.task_id} already assigned to current user ${userId}`, TriageService.name);
        }
      } else {
        this.logger.log(`No active triage task found for case ${existingCase.case_id}`, TriageService.name);
      }

      const { status, ...alertFields } = manualTriageDto;
      const updateAlertDto: UpdateAlertDto = { ...alertFields };

      const alert = await this.updateAlertData(alertId, updateAlertDto, userId, tenantId, triageTask?.task_id);
      if (triageTask) {
        this.logger.log(`Completing triage task ${triageTask.task_id} for user ${userId} with preserved assignment`, TriageService.name);
        await this.taskService.updateTask(
          triageTask.task_id,
          {
            status: TaskStatus.COMPLETED_30,
          },
          userId,
        );
      }

      const closableStatuses: CaseStatus[] = [
        CaseStatus.CLOSED_CONFIRMED_82,
        CaseStatus.CLOSED_REFUTED_81,
        CaseStatus.CLOSED_INCONCLUSIVE_83,
      ];

      if (closableStatuses.includes(existingCase.status)) {
        throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
      }

      if (manualTriageDto?.status && closableStatuses.includes(status)) {
        await this.caseService.updateCase(
          alert.case_id,
          { status: status, caseType: manualTriageDto.alertType, priority: priority },
          userId,
        );

        this.logger.log(
          `Manual triage handled for alert ${alertId}, case ${alert.case_id}. Outcome: Closed as ${status}`,
          TriageService.name,
        );
      } else {
        await this.caseService.updateCase(
          alert.case_id,
          { status: CaseStatus.READY_FOR_ASSIGNMENT_02, caseType: manualTriageDto.alertType, priority: priority },
          userId,
        );
        if (manualTriageDto.alertType === AlertType.FRAUD_AND_AML) {
          await this.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, alert.case_id, priority);
          await this.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, alert.case_id, priority);
        } else {
          await this.taskService.createTask(
            {
              caseId: alert.case_id,
              status: TaskStatus.UNASSIGNED_01,
              name: 'Investigate Case',
              description: `Investigate case: ${alert.case_id}`,
            },
            userId,
          );
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

  async updateAlertData(alertId: string, dto: UpdateAlertDto, userId: string, tenantId: string, taskId?: string) {
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
          priority_score: dto.priorityScore,
        },
      });

      const createCommentDto = new CreateCommentDto();
      createCommentDto.taskId = taskId;
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
          transaction: true,
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
      const prediction: Prediction = await this.predictAlert(alertId);
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
      const priority = this.determinePriority(predictedPriorityScore);
      await this.updateAlertAndUpdateTriageTask(
        alertId,
        triageTaskId,
        predictedAlertType,
        predictedConfidence,
        predictedPriorityScore,
        priority,
        predictedTruePositive,
        userId,
        tenantId,
      );

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
          priority,
          predictedAlertType,
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
          await this.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, caseId, priority);
          await this.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, caseId, priority);
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
            'Investigate Case for AML',
            'Triage complete - AI predicted confidence percentage above threshold and true positive with case type aml',
            priority,
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
            priority,
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
    priority: Priority,
  ): Promise<any> {
    try {
      // Create new case
      const newCase = await this.caseService.createCase(
        {
          caseCreatorUserId: userId,
          caseOwnerUserId: userId,
          tenantId,
          priority: priority,
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
          status: TaskStatus.UNASSIGNED_01,
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
    priority: Priority,
    caseType?: CaseType,
  ): Promise<any> {
    try {
      // Complete triage task first
      await this.taskService.updateTask(taskId, { status: TaskStatus.COMPLETED_30, description: triageTaskDesc }, userId);

      // Create new investigation task
      const createdTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.UNASSIGNED_01,
          name: 'Investigate case',
          description: investigateTaskDesc ?? `Task to investigate: ${caseId}`,
        },
        userId,
      );

      // Update case status
      const updateCaseDto: Partial<UpdateCaseDto> = {
        status: CaseStatus.READY_FOR_ASSIGNMENT_02,
        priority: priority,
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
    predictedPriorityScore: number,
    priority: Priority,
    predictedTruePositive: boolean,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      const updateDto = new UpdateAlertDto();

      updateDto.predictionOutcome = predictedTruePositive ? 'TRUE_POSITIVE' : 'FALSE_POSITIVE';
      updateDto.priority = priority;
      updateDto.alertType = predictedAlertType;
      updateDto.confidence_per = predictedConfidence;
      updateDto.priorityScore = predictedPriorityScore;
      updateDto.note = 'Updated alert data with AI outcome';

      await this.updateAlertData(alertId, updateDto, userId, tenantId, taskId);

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

      this.logger.log(`Alert ${alertId} updated and triage task ${taskId} annotated successfully.`, TriageService.name);
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId} and triage task ${taskId}. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update alert and triage task');
    }
  }

  private determinePriority(priorityScore: number): Priority {
    const urgencyThresholds = [
      parseFloat(this.configService.get<string>('PRIORITY_FIRST_HALF', '0.33')),
      parseFloat(this.configService.get<string>('PRIORITY_SECOND_HALF', '0.66')),
      parseFloat(this.configService.get<string>('PRIORITY_THIRD_HALF', '1.0')),
    ];

    if (priorityScore >= urgencyThresholds[2]) {
      return Priority.BREACH;
    } else if (priorityScore >= urgencyThresholds[1]) {
      return Priority.CRITICAL;
    } else if (priorityScore >= urgencyThresholds[0]) {
      return Priority.URGENT;
    } else {
      return Priority.NEW;
    }
  }

  public async predictAlert(alertId: string): Promise<{
    priorityScore: number;
    alertType: AlertType;
    confidence_per: number;
    isTruePositive: boolean; // true = real alarm, false = false alarm
  }> {
    // --- Placeholder AI Prediction ---
    this.logger.log(`Prediction for alert ${alertId} completed`, TriageService.name);
    return {
      priorityScore: 0.37,
      alertType: AlertType.FRAUD,
      confidence_per: 97,
      isTruePositive: true,
    };
  }
}
