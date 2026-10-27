import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CaseFacts } from './copilot.types';
import { chooseSubject, computeFacts, typologyOf, type NoteInput } from './facts';
import { pick, readPacs008, type Pacs008 } from './history';

const DAY = 86_400_000;

/** Plain text from the CMS rich-text notes editor. */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<\/(?:p|div|li|h\d)>|<br\s*\/?>/giv, '\n')
      .replace(/<[^>]+>/gv, '')
      .replace(/&nbsp;/gv, ' ')
      .replace(/&amp;/gv, '&')
      // eslint-disable-next-line @stylistic/quotes -- a lone single quote; double-quoting is the only form prettier and eslint agree on
      .replace(/&#39;|&apos;/gv, "'")
      .replace(/&quot;/gv, '"')
      .replace(/\n{2,}/gv, '\n')
      .trim()
  );
}

interface CaseRow {
  case_id: number;
  tenant_id: string;
  status: string;
  priority: string;
  case_type: string | null;
  created_at: Date;
  tasks: Array<{
    task_id: number;
    name: string | null;
    investigationNotes: string | null;
    assigned_user_id: string | null;
    updated_at: Date;
  }>;
}

/**
 * Reads one case as the copilot sees it: the case, its Tazama alert, the alert transaction and
 * the subject account's pacs.008 history from transaction_data, plus the comments and
 * investigation notes on the case and its tasks. Always scoped to the caller's tenant.
 *
 *   COPILOT_REPORTING_FSP     the deployment's own FSP id, to tell the customer from the counterparty (default fsp001)
 *   COPILOT_CTR_THRESHOLD     cash reporting threshold in local currency (default 2000000, Pakistan)
 *   COPILOT_HISTORY_DAYS      how far back to read history (default 365)
 */
@Injectable()
export class CaseFactsService {
  constructor(private readonly prisma: PrismaService) {}

  async load(caseId: number, tenantId: string): Promise<CaseFacts> {
    const c = await this.prisma.case.findFirst({
      where: { case_id: caseId, tenant_id: tenantId },
      include: { alert: true, tasks: { orderBy: { task_id: 'asc' } }, investigationGroup: { include: { alert: true } } },
    });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    const alert = c.alert ?? c.investigationGroup?.alert ?? null;
    const { trigger, subjectRole, history } = await this.transactions(tenantId, alert);
    return computeFacts({
      caseRow: c,
      alert: alert
        ? {
            alert_id: alert.alert_id,
            created_at: alert.created_at,
            alert_data: alert.alert_data,
            priority_score: alert.priority_score,
            confidence_per: alert.confidence_per,
          }
        : null,
      trigger,
      subjectRole,
      history,
      notes: await this.notes(c, tenantId),
      ctrThreshold: Number(process.env.COPILOT_CTR_THRESHOLD ?? 2_000_000),
    });
  }

  /** The alert transaction (pacs.008), which party is the subject, and that party's history. */
  private async transactions(
    tenantId: string,
    alert: { transaction: unknown; alert_data: unknown } | null,
  ): Promise<{ trigger: Pacs008 | null; subjectRole: 'debtor' | 'creditor' | null; history: Pacs008[] }> {
    const e2e = pick(alert?.transaction, 'FIToFIPmtSts', 'TxInfAndSts', 'OrgnlEndToEndId');
    if (typeof e2e !== 'string') return { trigger: null, subjectRole: null, history: [] };
    const rows = await this.prisma.transactionData.findMany({ where: { tenantId, endToEndId: e2e } });
    const trigger = rows.map((r) => readPacs008(r.transactionData)).find((p): p is Pacs008 => p !== null) ?? null;
    if (!trigger) return { trigger: null, subjectRole: null, history: [] };
    const subjectRole = chooseSubject(
      trigger,
      typologyOf(alert?.alert_data).rules.map((r) => r.id),
      process.env.COPILOT_REPORTING_FSP ?? 'fsp001',
    );
    const account = subjectRole === 'debtor' ? trigger.debtor.account : trigger.creditor.account;
    return { trigger, subjectRole, history: await this.history(tenantId, account, trigger.at) };
  }

  /** Comments on the case and its tasks, and the tasks' investigation notes. */
  private async notes(c: CaseRow, tenantId: string): Promise<NoteInput[]> {
    const comments = await this.prisma.comment.findMany({
      where: { tenant_id: tenantId, OR: [{ case_id: c.case_id }, { task_id: { in: c.tasks.map((t) => t.task_id) } }] },
      orderBy: { created_at: 'asc' },
    });
    const users = await this.prisma.cms_usernames.findMany({ where: { user_id: { in: [...new Set(comments.map((x) => x.user_id))] } } });
    const nameOf = (id: string): string => users.find((u) => u.user_id === id)?.name ?? 'system';
    const taskName = (id: number | null): string => c.tasks.find((t) => t.task_id === id)?.name ?? 'case';
    const notes: NoteInput[] = comments.map((x) => ({
      source: `Comment ${x.comment_id} on ${taskName(x.task_id)}`,
      author: nameOf(x.user_id),
      at: x.created_at,
      text: x.note,
    }));
    for (const t of c.tasks) {
      const text = t.investigationNotes ? htmlToText(t.investigationNotes) : '';
      if (text) {
        notes.push({
          source: `Investigation notes on task ${t.task_id} (${t.name ?? 'task'})`,
          author: t.assigned_user_id ? 'the assigned investigator' : 'investigator',
          at: t.updated_at,
          text,
        });
      }
    }
    return notes;
  }
  /** pacs.008 messages paying into or out of the account, from COPILOT_HISTORY_DAYS before the alert to 3 days after. */
  private async history(tenantId: string, account: string, at: Date): Promise<Pacs008[]> {
    const from = new Date(+at - Number(process.env.COPILOT_HISTORY_DAYS ?? 365) * DAY);
    const to = new Date(+at + 3 * DAY);
    const rows = await this.prisma.$queryRaw<Array<{ transactionData: unknown }>>`
      SELECT "transactionData" FROM transaction_data
      WHERE "tenantId" = ${tenantId}
        AND "transactionData"->>'TxTp' LIKE 'pacs.008%'
        AND "createdAt" BETWEEN ${from} AND ${to}
        AND ("transactionData" #>> '{FIToFICstmrCdtTrf,CdtTrfTxInf,DbtrAcct,Id,Othr,0,Id}' = ${account}
          OR "transactionData" #>> '{FIToFICstmrCdtTrf,CdtTrfTxInf,CdtrAcct,Id,Othr,0,Id}' = ${account})
      ORDER BY "createdAt"
      LIMIT 5000`;
    return rows.map((r) => readPacs008(r.transactionData)).filter((p): p is Pacs008 => p !== null);
  }
}
