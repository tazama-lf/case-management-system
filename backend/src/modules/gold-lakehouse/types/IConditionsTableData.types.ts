import type { Condition } from '@tazama-lf/frms-coe-lib/lib/interfaces/event-flow/Condition';

export interface ConditionsTableDataResponse {
  tableName: string;
  totalRows: number;
  data: Condition[];
  note: string;
}
