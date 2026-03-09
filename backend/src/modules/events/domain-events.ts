export class CaseCreatedEvent {
  constructor(
    public readonly caseId: number,
    public readonly tenantId: string,
    public readonly caseStatus: string,
    public readonly creationType: string,
    public readonly creatorRole: string,
    public readonly isReopened: boolean,
    public readonly isFraudNAML: boolean,
  ) {}
}

export class CaseStatusChangedEvent {
  constructor(
    public readonly caseId: number,
    public readonly newStatus: string,
  ) {}
}

export class CaseAbandonedEvent {
  constructor(
    public readonly caseId: number,
    public readonly reason: string,
  ) {}
}

export class CaseSuspendedEvent {
  constructor(
    public readonly caseId: number,
    public readonly reason: string,
  ) {}
}

export class CaseResumedEvent {
  constructor(
    public readonly caseId: number,
    public readonly reason: string,
  ) {}
}

export class TaskCreatedEvent {
  constructor(
    public readonly taskId: number,
    public readonly caseId: number,
    public readonly taskName: string,
    public readonly description: string,
    public readonly candidateGroup: string,
    public readonly status: string,
    public readonly assignedUserId?: string,
  ) {}
}

export class TaskStatusChangedEvent {
  constructor(
    public readonly taskId: number,
    public readonly caseId: number,
    public readonly taskName: string,
    public readonly newStatus: string,
    public readonly assignedUserId?: string | null,
    public readonly completionVariables?: Record<string, unknown>,
  ) {}
}

export class TaskAssignedEvent {
  constructor(
    public readonly taskId: number,
    public readonly caseId: number,
    public readonly assignedUserId: string,
    public readonly taskName?: string,
  ) {}
}

export class TaskUnassignedEvent {
  constructor(
    public readonly taskId: number,
    public readonly caseId: number,
    public readonly assignedUser: null,
    public readonly taskName?: string,
  ) {}
}

export class TaskCompletedEvent {
  constructor(
    public readonly caseId: number,
    public readonly taskName: string,
    public readonly newStatus: string,
    public readonly completionVariables?: Record<string, any>,
  ) {}
}

export class BpmnTaskCreatedEvent {
  constructor(
    public readonly flowableTaskId: string,
    public readonly caseId: string,
    public readonly taskName: number,
    public readonly description: string,
    public readonly candidateGroup: string,
  ) {}
}

export class TaskReassignedEvent {
  constructor(
    public readonly taskId: number,
    public readonly caseId: number,
    public readonly taskName: string,
    public readonly oldWorkQueueId: string | null,
    public readonly newWorkQueueId: string,
    public readonly oldWorkQueueName: string | null,
    public readonly newWorkQueueName: string,
    public readonly reassignedBy: string,
    public readonly tenantId: string,
    public readonly reason?: string,
    public readonly assignedUserId?: string,
    public readonly previousAssignedUserId?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
