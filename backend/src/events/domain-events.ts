export class CaseCreatedEvent {
    constructor(
        public readonly caseId: string,
        public readonly tenantId: string,
        public readonly creationType: string,
        public readonly creatorRole?: string,
        public readonly autocloseEligible: boolean = false,
    ) {}
}

export class CaseStatusChangedEvent {
    constructor(
        public readonly caseId: string,
        public readonly oldStatus: string,
        public readonly newStatus: string,
        public readonly reason?: string,
    ) {}
}

export class CaseAbandonedEvent {
    constructor(
        public readonly caseId: string,
        public readonly reason: string,
    ) {}
}
export class CaseSuspendedEvent {
    constructor(
        public readonly caseId: string,
        public readonly reason: string,
    ) {}
}
export class CaseResumedEvent {
    constructor(
        public readonly caseId: string,
        public readonly reason: string,
    ) {}
}

export class TaskCreatedEvent {
    constructor(
        public readonly taskId: string,
        public readonly caseId: string,
        public readonly taskName: string,
        public readonly description: string,
        public readonly candidateGroup: string,
        public readonly status: string,
        public readonly assignedUserId?: string,
    ) {}
}

export class TaskStatusChangedEvent {
    constructor(
        public readonly taskId: string,
        public readonly caseId: string,
        public readonly taskName: string,
        public readonly oldStatus: string,
        public readonly newStatus: string,
        public readonly assignedUserId?: string | null,
        public readonly completionVariables?: Record<string, any>,
    ) {}
}

export class TaskAssignedEvent {
    constructor(
        public readonly taskId: string,
        public readonly caseId: string,
        public readonly assignedUserId: string,
        public readonly previousAssignedUserId?: string,
    ) {}
}

export class TaskUnassignedEvent {
    constructor(
        public readonly taskId: string,
        public readonly caseId: string,
        public readonly previousAssignedUserId?: string,
        public readonly candidateGroup?: string,
        public readonly reason?: string,
    ) {}
}

// In your domain-events.ts file

export class TaskCompletedEvent {
    constructor(
        public readonly taskId: string,
        public readonly caseId: string,
        public readonly completedBy: string,
        public readonly variables?: Record<string, any>,
    ) {}
}

export class BpmnTaskCreatedEvent {
    constructor(
        public readonly flowableTaskId: string,
        public readonly caseId: string,
        public readonly taskName: string,
        public readonly description: string,
        public readonly candidateGroup: string,
    ) {}
}





