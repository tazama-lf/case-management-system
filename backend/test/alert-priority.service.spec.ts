import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertPriorityService } from '../src/modules/alert-priority/alert-priority.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { NotificationService } from '../src/modules/notification/notification.service';
import { SlaPolicyUtil } from '../src/modules/shared/utils/sla-policy.util';
import { CaseSlaBreachedEvent } from '../src/modules/events/domain-events';
import { CANDIDATE_GROUPS } from '../src/constants/case.constants';
import { CaseType, Prisma, SlaState } from '@prisma/client-cms';

describe('AlertPriorityService', () => {
  let service: AlertPriorityService;
  let prismaService: { slaEscalationRecord: { findUnique: jest.Mock; create: jest.Mock } };
  let caseRepository: jest.Mocked<CaseRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let slaPolicyUtil: jest.Mocked<SlaPolicyUtil>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const HOUR = 60 * 60 * 1000;

  const buildCase = (overrides: Partial<Record<string, unknown>> = {}) => ({
    case_id: 1,
    case_type: CaseType.FRAUD,
    case_owner_user_id: null,
    tenant_id: 'tenant-1',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    sla_started_at: new Date('2026-01-01T00:00:00.000Z'),
    sla_due_at: new Date('2026-01-03T00:00:00.000Z'), // 48h total budget
    ...overrides,
  });

  const createMockPrismaService = () => ({
    slaEscalationRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  });

  const createMockCaseRepository = () => ({
    findOpenCasesForSlaCheck: jest.fn(),
  });

  const createMockNotificationService = () => ({
    sendNotification: jest.fn(),
    sendGroupNotification: jest.fn(),
  });

  const createMockSlaPolicyUtil = () => ({
    getEscalationRatios: jest.fn().mockResolvedValue({ dueSoonRatio: 0.2, atRiskRatio: 0.5 }),
  });

  const createMockEventEmitter = () => ({
    emit: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityService,
        { provide: PrismaService, useValue: createMockPrismaService() },
        { provide: CaseRepository, useValue: createMockCaseRepository() },
        { provide: NotificationService, useValue: createMockNotificationService() },
        { provide: SlaPolicyUtil, useValue: createMockSlaPolicyUtil() },
        { provide: EventEmitter2, useValue: createMockEventEmitter() },
      ],
    }).compile();

    service = module.get<AlertPriorityService>(AlertPriorityService);
    prismaService = module.get(PrismaService);
    caseRepository = module.get(CaseRepository);
    notificationService = module.get(NotificationService);
    slaPolicyUtil = module.get(SlaPolicyUtil);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runSlaEscalationCheck', () => {
    it('does nothing when there are no open cases', async () => {
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([]);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('sends a claim-chase group notification for an unclaimed case that just entered AT_RISK', async () => {
      // 48h budget, now = created_at + 30h -> remaining 18h -> ratio 0.375 -> AT_RISK
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          type: 'CASE_CLAIM_CHASE',
          metadata: expect.objectContaining({ caseId: 1, slaState: SlaState.AT_RISK }),
        }),
      );
      expect(prismaService.slaEscalationRecord.create).toHaveBeenCalledWith({
        data: { case_id: 1, sla_state: SlaState.AT_RISK },
      });
      jest.useRealTimers();
    });

    it('does not re-notify a case already recorded for that (case_id, sla_state) pair', async () => {
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue({
        id: 1,
        case_id: 1,
        sla_state: SlaState.AT_RISK,
        notified_at: new Date(),
      });

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(prismaService.slaEscalationRecord.create).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('sends a support-chase notification to the owner for an owned case that reached DUE_SOON', async () => {
      // 48h budget, now = created_at + 40h -> remaining 8h -> ratio ~0.167 -> DUE_SOON
      const now = new Date('2026-01-02T16:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: 'owner-123' });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-123',
          type: 'CASE_SUPPORT_CHASE',
          metadata: expect.objectContaining({ caseId: 1, slaState: SlaState.DUE_SOON, assignee: 'owner-123' }),
        }),
      );
      expect(prismaService.slaEscalationRecord.create).toHaveBeenCalledWith({
        data: { case_id: 1, sla_state: SlaState.DUE_SOON },
      });
      jest.useRealTimers();
    });

    it('does not notify an unclaimed case that is DUE_SOON (only AT_RISK triggers claim-chase)', async () => {
      const now = new Date('2026-01-02T16:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('does not notify an owned case that is only AT_RISK (only DUE_SOON triggers support-chase)', async () => {
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: 'owner-123' });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('does not notify a case that is still ON_TRACK', async () => {
      const now = new Date('2026-01-01T06:00:00.000Z'); // 6h elapsed of 48h -> ON_TRACK
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('does not create an escalation record when sending the notification fails, so it retries next tick', async () => {
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);
      notificationService.sendGroupNotification.mockRejectedValue(new Error('smtp down'));

      await service.runSlaEscalationCheck();

      expect(prismaService.slaEscalationRecord.create).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('swallows a unique constraint violation on the escalation record (concurrent tick race)', async () => {
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);
      prismaService.slaEscalationRecord.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' }),
      );

      await expect(service.runSlaEscalationCheck()).resolves.not.toThrow();
    });

    it('propagates non-constraint errors from recording the escalation', async () => {
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);
      prismaService.slaEscalationRecord.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.runSlaEscalationCheck()).rejects.toThrow('connection lost');
    });

    it('skips cases with no sla_due_at', async () => {
      const caseRecord = buildCase({ sla_due_at: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });

    it("uses the case's tenant-specific escalation ratios instead of the global default", async () => {
      // 48h budget, now = created_at + 30h -> remaining 18h -> ratio 0.375.
      // Default ratios (0.2/0.5) would classify this as AT_RISK (0.2 < 0.375 <= 0.5),
      // but this tenant's widened due-soon ratio (0.4) should push it to DUE_SOON instead.
      const now = new Date('2026-01-02T06:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: 'owner-123', tenant_id: 'tenant-strict' });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);
      slaPolicyUtil.getEscalationRatios.mockResolvedValue({ dueSoonRatio: 0.4, atRiskRatio: 0.5 });

      await service.runSlaEscalationCheck();

      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-strict');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ slaState: SlaState.DUE_SOON }) }),
      );
      jest.useRealTimers();
    });

    it('sends a supervisor group notification and emits case.sla-breached for an unclaimed BREACHED case', async () => {
      const now = new Date('2026-01-03T01:00:00.000Z'); // past the 48h sla_due_at -> BREACHED
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
          type: 'CASE_SLA_BREACHED',
          metadata: expect.objectContaining({ caseId: 1, slaState: SlaState.BREACHED }),
        }),
      );
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'case.sla-breached',
        new CaseSlaBreachedEvent(1, 'tenant-1', CaseType.FRAUD, null, caseRecord.sla_due_at),
      );
      expect(prismaService.slaEscalationRecord.create).toHaveBeenCalledWith({
        data: { case_id: 1, sla_state: SlaState.BREACHED },
      });
      jest.useRealTimers();
    });

    it('escalates a BREACHED case even when it is already claimed', async () => {
      const now = new Date('2026-01-03T01:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: 'owner-123' });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).toHaveBeenCalledWith(
        expect.objectContaining({ candidateGroup: CANDIDATE_GROUPS.SUPERVISORS, type: 'CASE_SLA_BREACHED' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('case.sla-breached', expect.any(CaseSlaBreachedEvent));
      jest.useRealTimers();
    });

    it('does not re-notify or re-emit for a case already recorded as BREACHED', async () => {
      const now = new Date('2026-01-03T01:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue({
        id: 1,
        case_id: 1,
        sla_state: SlaState.BREACHED,
        notified_at: new Date(),
      });

      await service.runSlaEscalationCheck();

      expect(notificationService.sendGroupNotification).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(prismaService.slaEscalationRecord.create).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('does not emit case.sla-breached when the breach notification fails to send', async () => {
      const now = new Date('2026-01-03T01:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const caseRecord = buildCase({ case_owner_user_id: null });
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([caseRecord] as any);
      prismaService.slaEscalationRecord.findUnique.mockResolvedValue(null);
      notificationService.sendGroupNotification.mockRejectedValue(new Error('smtp down'));

      await service.runSlaEscalationCheck();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(prismaService.slaEscalationRecord.create).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('resolves ratios once per distinct tenant, not once per case', async () => {
      const now = new Date('2026-01-01T06:00:00.000Z'); // ON_TRACK for all — no notification side effects to assert on
      jest.useFakeTimers().setSystemTime(now);
      caseRepository.findOpenCasesForSlaCheck.mockResolvedValue([
        buildCase({ case_id: 1, tenant_id: 'tenant-a' }),
        buildCase({ case_id: 2, tenant_id: 'tenant-a' }),
        buildCase({ case_id: 3, tenant_id: 'tenant-b' }),
      ] as any);

      await service.runSlaEscalationCheck();

      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledTimes(2);
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-a');
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-b');
      jest.useRealTimers();
    });
  });
});
