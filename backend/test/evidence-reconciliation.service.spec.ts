import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceReconciliationService } from '../src/modules/evidence/evidence-reconciliation.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { EvidenceRepository } from '../src/modules/repository/evidence.repository';

describe('EvidenceReconciliationService', () => {
  let service: EvidenceReconciliationService;
  let couchdbService: any;
  let evidenceRepository: any;

  const now = new Date('2026-10-30T12:00:00.000Z').getTime();
  const minutesAgo = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceReconciliationService,
        {
          provide: CouchdbService,
          useValue: { findPendingEvidenceOlderThan: jest.fn(), updateDocument: jest.fn(), deleteDocument: jest.fn() },
        },
        { provide: EvidenceRepository, useValue: { evidenceExists: jest.fn() } },
      ],
    }).compile();

    service = module.get(EvidenceReconciliationService);
    couchdbService = module.get(CouchdbService);
    evidenceRepository = module.get(EvidenceRepository);

    couchdbService.updateDocument.mockResolvedValue({ ok: true });
    couchdbService.deleteDocument.mockResolvedValue({ ok: true });
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks for pending documents at least 2 minutes old, 200 at a time', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([]);

    await service.reconcilePendingEvidence();

    expect(couchdbService.findPendingEvidenceOlderThan).toHaveBeenCalledWith(minutesAgo(2), 200);
  });

  it('promotes a pending document whose Postgres row exists, and never deletes it', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([{ _id: 'ev_1_1', _rev: '1-a', uploadedAt: minutesAgo(5) }]);
    evidenceRepository.evidenceExists.mockResolvedValue(true);

    await service.reconcilePendingEvidence();

    expect(couchdbService.updateDocument).toHaveBeenCalledWith('ev_1_1', { status: 'committed' });
    expect(couchdbService.deleteDocument).not.toHaveBeenCalled();
  });

  it('promotes, not deletes, a document with a Postgres row even when it is far older than the abandon limit', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([{ _id: 'ev_1_1', _rev: '1-a', uploadedAt: minutesAgo(600) }]);
    evidenceRepository.evidenceExists.mockResolvedValue(true);

    await service.reconcilePendingEvidence();

    expect(couchdbService.updateDocument).toHaveBeenCalledWith('ev_1_1', { status: 'committed' });
    expect(couchdbService.deleteDocument).not.toHaveBeenCalled();
  });

  it('removes a pending document with no Postgres row once it is older than 30 minutes', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([{ _id: 'ev_1_1', _rev: '3-c', uploadedAt: minutesAgo(31) }]);
    evidenceRepository.evidenceExists.mockResolvedValue(false);

    await service.reconcilePendingEvidence();

    expect(couchdbService.deleteDocument).toHaveBeenCalledWith('ev_1_1', '3-c');
    expect(couchdbService.updateDocument).not.toHaveBeenCalled();
  });

  it('leaves a pending document with no Postgres row alone while it is younger than 30 minutes (an upload may still be running)', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([{ _id: 'ev_1_1', _rev: '1-a', uploadedAt: minutesAgo(10) }]);
    evidenceRepository.evidenceExists.mockResolvedValue(false);

    await service.reconcilePendingEvidence();

    expect(couchdbService.deleteDocument).not.toHaveBeenCalled();
    expect(couchdbService.updateDocument).not.toHaveBeenCalled();
  });

  it('handles a mixed batch, each document on its own merits', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([
      { _id: 'finished', _rev: '1-a', uploadedAt: minutesAgo(5) },
      { _id: 'abandoned', _rev: '2-b', uploadedAt: minutesAgo(45) },
      { _id: 'running', _rev: '3-c', uploadedAt: minutesAgo(3) },
    ]);
    evidenceRepository.evidenceExists.mockImplementation(async (id: string) => id === 'finished');

    await service.reconcilePendingEvidence();

    expect(couchdbService.updateDocument).toHaveBeenCalledTimes(1);
    expect(couchdbService.updateDocument).toHaveBeenCalledWith('finished', { status: 'committed' });
    expect(couchdbService.deleteDocument).toHaveBeenCalledTimes(1);
    expect(couchdbService.deleteDocument).toHaveBeenCalledWith('abandoned', '2-b');
  });

  it('keeps going when one document fails, and logs it', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([
      { _id: 'ev_1_1', _rev: '1-a', uploadedAt: minutesAgo(45) },
      { _id: 'ev_1_2', _rev: '2-b', uploadedAt: minutesAgo(45) },
    ]);
    evidenceRepository.evidenceExists.mockResolvedValue(false);
    couchdbService.deleteDocument.mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce({ ok: true });

    await expect(service.reconcilePendingEvidence()).resolves.toBeUndefined();

    expect(couchdbService.deleteDocument).toHaveBeenCalledTimes(2);
    expect((service as any).logger.error).toHaveBeenCalledWith(expect.stringContaining('ev_1_1'));
  });

  it('never deletes anything when Postgres cannot be asked', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockResolvedValue([{ _id: 'ev_1_1', _rev: '1-a', uploadedAt: minutesAgo(600) }]);
    evidenceRepository.evidenceExists.mockRejectedValue(new Error('postgres down'));

    await expect(service.reconcilePendingEvidence()).resolves.toBeUndefined();

    expect(couchdbService.deleteDocument).not.toHaveBeenCalled();
    expect(couchdbService.updateDocument).not.toHaveBeenCalled();
  });

  it('does not throw when the CouchDB query itself fails', async () => {
    couchdbService.findPendingEvidenceOlderThan.mockRejectedValue(new Error('couch down'));

    await expect(service.reconcilePendingEvidence()).resolves.toBeUndefined();

    expect(couchdbService.deleteDocument).not.toHaveBeenCalled();
  });
});
