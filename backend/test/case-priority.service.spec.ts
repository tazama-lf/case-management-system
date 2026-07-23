import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasePriorityService } from '../src/modules/alert-priority/case-priority.service';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { CasePriorityChangedEvent } from '../src/modules/events/domain-events';
import { Priority } from '@prisma/client-cms';

describe('CasePriorityService', () => {
  let service: CasePriorityService;
  let caseRepository: jest.Mocked<CaseRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const buildCase = (overrides: Partial<Record<string, unknown>> = {}) => ({
    case_id: 1,
    tenant_id: 'tenant-1',
    priority: Priority.LOW,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    sla_due_at: new Date('2026-01-08T00:00:00.000Z'),
    ...overrides,
  });

  const createMockCaseRepository = () => ({
    findCaseById: jest.fn(),
    updateCase: jest.fn(),
  });

  const createMockEventEmitter = () => ({
    emit: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasePriorityService,
        { provide: CaseRepository, useValue: createMockCaseRepository() },
        { provide: EventEmitter2, useValue: createMockEventEmitter() },
      ],
    }).compile();

    service = module.get<CasePriorityService>(CasePriorityService);
    caseRepository = module.get(CaseRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('changePriority', () => {
    it('updates the case priority and emits a PriorityChanged event with the correct payload', async () => {
      const existingCase = buildCase({ priority: Priority.LOW });
      const updatedCase = buildCase({ priority: Priority.HIGH, sla_due_at: new Date('2026-01-02T00:00:00.000Z') });
      caseRepository.findCaseById.mockResolvedValue(existingCase as any);
      caseRepository.updateCase.mockResolvedValue(updatedCase as any);

      const result = await service.changePriority(1, Priority.HIGH, 'user-1', 'tenant-1', 'Escalated per new evidence');

      expect(caseRepository.findCaseById).toHaveBeenCalledWith(1, 'tenant-1');
      expect(caseRepository.updateCase).toHaveBeenCalledWith(1, { priority: Priority.HIGH });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'case.priority.changed',
        new CasePriorityChangedEvent(1, 'user-1', Priority.LOW, Priority.HIGH, 'Escalated per new evidence'),
      );
      expect(result).toEqual({
        case: updatedCase,
        caseId: 1,
        actorId: 'user-1',
        oldPriority: Priority.LOW,
        newPriority: Priority.HIGH,
        reason: 'Escalated per new evidence',
      });
    });

    it('defaults reason to null in the result when none is provided', async () => {
      const existingCase = buildCase({ priority: Priority.MEDIUM });
      const updatedCase = buildCase({ priority: Priority.HIGH });
      caseRepository.findCaseById.mockResolvedValue(existingCase as any);
      caseRepository.updateCase.mockResolvedValue(updatedCase as any);

      const result = await service.changePriority(1, Priority.HIGH, 'user-1', 'tenant-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'case.priority.changed',
        new CasePriorityChangedEvent(1, 'user-1', Priority.MEDIUM, Priority.HIGH, undefined),
      );
      expect(result.reason).toBeNull();
    });
  });
});
