import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client-cms';
import { EventPhase, type IAuditService } from '@tazama-lf/audit-lib';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ChainReport } from './copilot.types';
import { recordHash, type ChainedFields } from './record-chain';

export type RecordKind = 'INVESTIGATION' | 'ASK' | 'SAR_DRAFT' | 'SAR_REVIEW' | 'FEEDBACK';

export interface NewRecord {
  caseId: number;
  tenantId: string;
  kind: RecordKind;
  userId: string;
  provider: string;
  model?: string | null;
  embeddingModel?: string | null;
  parentId?: number;
  payload: object;
}

export interface StoredRecord {
  id: number;
  caseId: number;
  kind: string;
  parentId: number | null;
  createdBy: string;
  provider: string;
  model: string | null;
  embeddingModel: string | null;
  createdAt: Date;
  payload: unknown;
}

type Row = Prisma.CopilotRecordGetPayload<object>;

/** Records per read when verifying; investigation records carry their fact vectors (about 100 KB each). */
const VERIFY_BATCH = 100;

const toStored = (r: Row): StoredRecord => ({
  id: r.id,
  caseId: r.case_id,
  kind: r.kind,
  parentId: r.parent_id,
  createdBy: r.created_by,
  provider: r.provider,
  model: r.model,
  embeddingModel: r.embedding_model,
  createdAt: r.created_at,
  payload: r.payload,
});

const chainedFields = (r: Row): ChainedFields => ({
  caseId: r.case_id,
  tenantId: r.tenant_id,
  kind: r.kind,
  parentId: r.parent_id,
  createdBy: r.created_by,
  provider: r.provider,
  model: r.model,
  embeddingModel: r.embedding_model,
  payload: r.payload,
  createdAt: r.created_at.toISOString(),
  prevHash: r.prev_hash,
});

/**
 * The only place that reads and writes copilot_records. Records are append-only: nothing here updates or deletes.
 * Each tenant's records form a hash chain (each hash covers the record and the previous hash), and each new hash is
 * also written to the CMS audit log, so a changed or removed record, including the newest, can be detected.
 */
@Injectable()
export class RecordStore {
  private readonly logger = new Logger(RecordStore.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('AUDIT_LOGGER') private readonly audit?: IAuditService,
  ) {}

  async create(record: NewRecord): Promise<StoredRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      // one writer per tenant at a time, so the chain never forks
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`copilot_records:${record.tenantId}`}))::text`;
      const last = await tx.copilotRecord.findFirst({
        where: { tenant_id: record.tenantId, hash: { not: null } },
        orderBy: { id: 'desc' },
        select: { hash: true },
      });
      const created = await tx.copilotRecord.create({
        data: {
          case_id: record.caseId,
          tenant_id: record.tenantId,
          kind: record.kind,
          parent_id: record.parentId ?? null,
          created_by: record.userId,
          provider: record.provider,
          model: record.model ?? null,
          embedding_model: record.embeddingModel ?? null,
          payload: record.payload,
          prev_hash: last?.hash ?? null,
        },
      });
      // Hash the row as the database holds it (JSON numbers come back rounded), so verifying reads exactly what was hashed.
      return await tx.copilotRecord.update({ where: { id: created.id }, data: { hash: recordHash(chainedFields(created)) } });
    });
    this.anchor(row);
    return toStored(row);
  }

  async latest(caseId: number, tenantId: string, kind: RecordKind): Promise<StoredRecord | null> {
    const row = await this.prisma.copilotRecord.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, kind },
      orderBy: { id: 'desc' },
    });
    return row ? toStored(row) : null;
  }

  async children(caseId: number, tenantId: string, kind: RecordKind, parentId: number): Promise<StoredRecord[]> {
    const rows = await this.prisma.copilotRecord.findMany({
      where: { case_id: caseId, tenant_id: tenantId, kind, parent_id: parentId },
      orderBy: { id: 'asc' },
    });
    return rows.map(toStored);
  }

  async byId(caseId: number, tenantId: string, id: number): Promise<StoredRecord | null> {
    const row = await this.prisma.copilotRecord.findFirst({ where: { id, case_id: caseId, tenant_id: tenantId } });
    return row ? toStored(row) : null;
  }

  /** A tenant's records since a date, oldest first, without the stored fact vectors (they are large and not needed to report). */
  async since(tenantId: string, from: Date): Promise<StoredRecord[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT id, case_id, tenant_id, kind, parent_id, created_by, provider, model, embedding_model,
             payload - 'vectors' AS payload, created_at, prev_hash, hash
      FROM copilot_records WHERE tenant_id = ${tenantId} AND created_at >= ${from} ORDER BY id`;
    return rows.map(toStored);
  }

  /** Walks a tenant's records in order and recomputes every hash and link. */
  async verifyChain(tenantId: string): Promise<ChainReport> {
    let head: string | null = null;
    let checked = 0;
    let unchained = 0;
    let after = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- batches are read in order; each depends on where the last one ended
      const rows = await this.prisma.copilotRecord.findMany({
        where: { tenant_id: tenantId, id: { gt: after } },
        orderBy: { id: 'asc' },
        take: VERIFY_BATCH,
      });
      if (!rows.length) return { ok: true, checked, unchained, head };
      for (const r of rows) {
        after = r.id;
        if (r.hash === null) {
          unchained += 1;
          continue;
        }
        if (r.prev_hash !== head) {
          return { ok: false, checked, unchained, head, brokenAt: r.id, reason: 'the record before it was removed or changed' };
        }
        if (recordHash(chainedFields(r)) !== r.hash) {
          return { ok: false, checked, unchained, head, brokenAt: r.id, reason: 'the record was changed after it was written' };
        }
        head = r.hash;
        checked += 1;
      }
    }
  }

  /** Writes the new record's hash to the CMS audit log, a second store, so removing the newest records shows too. */
  private anchor(row: Row): void {
    if (!this.audit) return;
    this.audit
      .log({
        correlationId: randomUUID(),
        eventPhase: EventPhase.SUCCESS,
        eventType: 'COPILOT_RECORD_WRITTEN',
        actorId: row.created_by,
        actorRole: 'SYSTEM',
        actorName: 'copilot record store',
        resourceType: 'copilot-record',
        resourceId: String(row.id),
        sourceIp: 'internal',
        description: `copilot ${row.kind} record ${row.id} for case ${row.case_id}`,
        tenantId: row.tenant_id,
        outcome: { hash: row.hash, prevHash: row.prev_hash, kind: row.kind, caseId: row.case_id },
      })
      .catch((e: unknown) => {
        this.logger.warn(`audit anchor for copilot record ${row.id} failed: ${e instanceof Error ? e.message : String(e)}`);
      });
  }
}
