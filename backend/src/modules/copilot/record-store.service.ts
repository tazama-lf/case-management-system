import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';

export type RecordKind = 'INVESTIGATION' | 'ASK' | 'SAR_DRAFT' | 'SAR_REVIEW';

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

/** The only place that reads and writes copilot_records. Records are append-only: nothing here updates or deletes. */
@Injectable()
export class RecordStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: NewRecord): Promise<StoredRecord> {
    const row = await this.prisma.copilotRecord.create({
      data: {
        case_id: record.caseId,
        tenant_id: record.tenantId,
        kind: record.kind,
        parent_id: record.parentId,
        created_by: record.userId,
        provider: record.provider,
        model: record.model ?? null,
        embedding_model: record.embeddingModel ?? null,
        payload: record.payload,
      },
    });
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
}
